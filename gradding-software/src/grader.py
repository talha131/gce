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
            return 0.0, {}
            
        # Get all keys from the mapping
        unweighted_keys = self.config.COLUMN_MAPPING["unweighted"].keys()
        
        details = {}
        total = 0.0
        for key in unweighted_keys:
            raw_val = row.get(key, 0)
            total += raw_val
            
            # Record details
            details[f"{key}_raw"] = raw_val
            details[f"{key}_final"] = raw_val # Unweighted means raw = final usually
            
        return total, details

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
            
        return term_score, {"quizzes_raw": score, "quizzes_final": term_score}

    def apply_assignments(self, row: pd.Series, stats_modifiers: dict) -> float:
        """
        Rule C: Assignments (Performance Spectrum).
        """
        assign_total = 0.0
        details = {}
        
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
             
             # Record details
             details[f"{a_key}_raw"] = score
             details[f"{a_key}_final"] = term_score
             
        return assign_total, details

    def apply_internal_exam(self, row: pd.Series, stats_modifiers: dict) -> float:
        """
        Rule E: Internal Exam (Anchor).
        """
        exam_score = row.get("internal_exam", 0)
        weight = stats_modifiers.get("internal_exam", 1.0)
        final_score = exam_score * weight
        
        return final_score, {"internal_exam_raw": exam_score, "internal_exam_final": final_score}

    def calculate_composite_score(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Orchestrates all rules.
        """
        # 1. Calculate Stats Modifiers
        # We need raw total proxy.
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        cols_to_sum = [c for c in numeric_cols if c not in ["student_id", "temp_raw_total", "name", "father_name"]]
        
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
                 
             # Lookup Max Score.
             # Now standardizing on Internal IDs in config.MAX_SCORES.
             
             # Direct lookup:
             max_s = self.config.MAX_SCORES.get(col, 10.0)
             
             diff = self.stats_engine.calculate_difficulty(df[col], max_s)
             disc = self.stats_engine.calculate_discrimination(df, col, 'temp_raw_total')
             
             weight = self.stats_engine.get_weight_modifier(diff, disc)
             stats_modifiers[col] = weight
             
        # 2. Apply Rules
        results = []
        for index, row in df.iterrows():
            unweighted_score, unweighted_details = self.apply_unweighted(row)
            quiz_score, quiz_details = self.apply_quizzes(row, stats_modifiers)
            assign_score, assign_details = self.apply_assignments(row, stats_modifiers)
            exam_score, exam_details = self.apply_internal_exam(row, stats_modifiers)
            
            # Sum up components
            # Note: Unweighted (formerly Attendance) is additive.
            tentative_total = unweighted_score + quiz_score + assign_score + exam_score
            
            # Build Result Row
            result_row = {
                "student_id": row.get("student_id"),
                "name": row.get("name"),
                "father_name": row.get("father_name"),
                
                # Add Details (unpack dictionaries)
                **unweighted_details,
                **assign_details,
                **quiz_details,
                **exam_details,
                
            }
            
            # Calculate student-specific stats_weight_factor
            # This should be the weighted average of stats modifiers for items this student scored on
            total_raw_score = 0.0
            weighted_modifier_sum = 0.0
            
            # Process all graded items (skip unweighted)
            for col in stats_modifiers.keys():
                if col in self.config.COLUMN_MAPPING["unweighted"].keys():
                    continue
                raw_score = row.get(col, 0)
                modifier = stats_modifiers.get(col, 1.0)
                
                total_raw_score += raw_score
                weighted_modifier_sum += raw_score * modifier
            
            # Calculate weighted average
            if total_raw_score > 0:
                student_weight_factor = weighted_modifier_sum / total_raw_score
            else:
                student_weight_factor = 1.0
            
            result_row["raw_total"] = float(tentative_total)
            result_row["stats_weight_factor"] = student_weight_factor
            
            results.append(result_row)
            
        return pd.DataFrame(results)
