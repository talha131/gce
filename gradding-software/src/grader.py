import pandas as pd
import numpy as np
from src.stats import StatsEngine

class GradingEngine:
    """
    Applies grading rules A, B, C, D, E.
    """

    def __init__(self, config):
        self.config = config
        self.stats_engine = StatsEngine(config)

    def apply_unweighted(self, row: pd.Series) -> float:
        """
        Rule A: Unweighted Activities (formerly Attendance).
        Sum of columns mapped in 'unweighted'.
        If UNWEIGHTED_ACTIVITY_MODE is "Additive", this adds to the numerator but 
        should NOT affect the statistical weighting of other items (usually).
        """
        if self.config.UNWEIGHTED_ACTIVITY_MODE != "Additive":
            return 0.0
            
        # Get all keys from the mapping
        unweighted_keys = self.config.COLUMN_MAPPING["unweighted"].keys()
        
        total = 0.0
        for key in unweighted_keys:
            total += row.get(key, 0)
            
        return total

    def apply_quizzes(self, row: pd.Series, stats_modifiers: dict) -> float:
        """
        Rule B: Quizzes (Hygiene Factor).
        Now operates on a single CONSOLIDATED score column: "quizzes".
        """
        # Internal key is just "quizzes" from loader renaming
        score = row.get("quizzes", 0)
        
        # 1. Apply Statistical Weighting (IRT-Lite)
        # Key in stats modifiers works on the internal column name "quizzes"
        # provided config.MAX_SCORES has a key for the original CSV Header name? 
        # No, stats need to know the internal column name if renamed.
        # But config.MAX_SCORES keys are mixed? 
        
        # Check usage in calculate_composite_score: 
        # max_s = self.config.MAX_SCORES.get(col, 10.0) where col is internal name.
        # So MAX_SCORES keys must match internal names OR csv headers depending on logic.
        # Loader renames everything to internal names (e.g., 'quizzes', 'assign_1').
        # So MAX_SCORES should use INTERNAL names ideally, or we map.
        # User defined MAX_SCORES with CSV Header "Quiz_Total"? 
        # Wait, user sees config.py. User sets MAX_SCORES["Quiz_Total"] = 30.
        # Loader maps "Quiz_Total" -> "quizzes".
        # So we need to look up safely.
        
        # Let's find weight. internal col is "quizzes".
        weight = stats_modifiers.get("quizzes", 1.0)
        weighted_score = score * weight
        
        # 2. Apply Hygiene Penalty
        if score < self.config.QUIZ_PASS_THRESHOLD:
            term_score = weighted_score * self.config.QUIZ_PENALTY_MULTIPLIER
        else:
            term_score = weighted_score
            
        return term_score

    def apply_assignments(self, row: pd.Series, stats_modifiers: dict) -> float:
        """
        Rule C: Assignments (Performance Spectrum).
        """
        assign_total = 0.0
        
        for a_key in self.config.COLUMN_MAPPING["assignments"].keys():
             
             score = row.get(a_key, 0)
             
             # 1. Apply Statistical Weighting
             weight = stats_modifiers.get(a_key, 1.0)
             weighted_score = score * weight
             
             # 2. Performance Spectrum
             # We need max score. In config, user uses keys like "assign_1".
             # This works because loader maps "A1_Oct2" -> "assign_1".
             max_score = self.config.MAX_SCORES.get(a_key, 10.0)
             
             ratio = score / max_score if max_score > 0 else 0
             
             if ratio > self.config.ASSIGNMENT_MASTERY_THRESHOLD:
                 term_score = weighted_score * self.config.ASSIGNMENT_MASTERY_MULTIPLIER
             elif ratio < self.config.ASSIGNMENT_LAGGING_THRESHOLD:
                 term_score = weighted_score * self.config.ASSIGNMENT_LAGGING_PENALTY
             else:
                 term_score = weighted_score
                 
             assign_total += term_score
             
        return assign_total

    def apply_internal_exam(self, row: pd.Series, stats_modifiers: dict) -> float:
        """
        Rule E: Internal Exam (Anchor).
        """
        exam_score = row.get("internal_exam", 0)
        weight = stats_modifiers.get("internal_exam", 1.0)
        return exam_score * weight

    def calculate_composite_score(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Orchestrates all rules.
        """
        # 1. Calculate Stats Modifiers
        # We need raw total proxy.
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        cols_to_sum = [c for c in numeric_cols if c not in ["student_id", "temp_raw_total", "name"]]
        
        df['temp_raw_total'] = df[cols_to_sum].sum(axis=1)
        
        stats_modifiers = {}
        for col in cols_to_sum:
             # Skip unweighted columns for stats calculation?
             # User asked: "The code uses Item response theory?" -> Yes.
             # Unweighted "Unweighted" columns shouldn't affect the model? 
             # Usually "Attendance" doesn't have difficulty.
             # Let's check if col is in 'unweighted'
             if col in self.config.COLUMN_MAPPING["unweighted"].keys():
                 continue
                 
             # Lookup Max Score. User Config uses keys: "Quiz_Total" (Header) or "assign_1" (Internal)?
             # Config.MAX_SCORES currently has mixed: "Quiz_Total", "assign_1".
             # This is tricky. 
             # Loader maps: "Quiz_Total" -> "quizzes".
             # So df has 'quizzes'. 
             # We need to look up max score for 'quizzes'.
             # Strategy: Try key 'col', if not found, try mapping back to CSV header?
             
             # Simple lookup:
             max_s = 10.0
             if col == "quizzes": 
                 # Config has key "Quiz_Total" -> Need to resolve.
                 # Let's map internal 'quizzes' -> csv header 'Quiz_Total' via config mapping.
                 header = self.config.COLUMN_MAPPING["quizzes"]
                 max_s = self.config.MAX_SCORES.get(header, 10.0)
             elif col == "internal_exam":
                 header = self.config.COLUMN_MAPPING["internal_exam"]
                 max_s = self.config.MAX_SCORES.get(header, 10.0)
             else:
                 # Assignments/Unweighted use internal keys in config map?
                 # Config.COLUMN_MAPPING["assignments"] = {"assign_1": "..."}
                 # Config.MAX_SCORES = {"assign_1": 20}
                 # So if col is "assign_1", direct lookup works.
                 max_s = self.config.MAX_SCORES.get(col, 10.0)
             
             diff = self.stats_engine.calculate_difficulty(df[col], max_s)
             disc = self.stats_engine.calculate_discrimination(df, col, 'temp_raw_total')
             
             weight = self.stats_engine.get_weight_modifier(diff, disc)
             stats_modifiers[col] = weight
             
        # 2. Apply Rules
        results = []
        for index, row in df.iterrows():
            unweighted_score = self.apply_unweighted(row)
            quiz_score = self.apply_quizzes(row, stats_modifiers)
            assign_score = self.apply_assignments(row, stats_modifiers)
            exam_score = self.apply_internal_exam(row, stats_modifiers)
            
            # Sum up components
            # Note: Unweighted (formerly Attendance) is additive.
            tentative_total = unweighted_score + quiz_score + assign_score + exam_score
            
            results.append({
                "student_id": row.get("student_id"),
                "name": row.get("name"),
                "raw_total": float(tentative_total),
                "bonus_applied": False, 
                "stats_weight_factor": np.mean(list(stats_modifiers.values())) if stats_modifiers else 1.0
            })
            
        return pd.DataFrame(results)
