import pandas as pd
import numpy as np

class StatsEngine:
    """
    Calculates statistical properties of graded items to adjust weights.
    Implements a simplified Item Response Theory (IRT) approach.
    """

    def __init__(self, config):
        self.config = config

    def calculate_difficulty(self, series: pd.Series, max_score: float) -> float:
        """
        Calculates the Difficulty Index (p-value).
        p = Mean Score / Max Possible Score
        
        Returns:
            float: A value between 0 (Hardest) and 1 (Easiest).
        """
        if max_score == 0:
            return 0.0
        return series.mean() / max_score

    def calculate_discrimination(self, df: pd.DataFrame, item_col: str, total_col: str) -> float:
        """
        Calculates the Discrimination Index using Point-Biserial Correlation.
        Measures how well the item distinguishes high performers from low performers.
        
        Args:
            df: Dataframe containing student scores.
            item_col: The column name of the item being analyzed.
            total_col: The column name representing the total score (proxy for ability).
            
        Returns:
            float: Correlation coefficient (-1 to 1). higher is better.
        """
        # We need to correlate the item score with the total score (excluding the item itself ideally, 
        # but for simplicity total is fine if dataset is large enough. 
        # Corrected item-total correlation is better: Total - Item)
        
        # Calculate 'Rest Score' (Total - Item Score) to avoid auto-correlation
        rest_scores = df[total_col] - df[item_col]
        
        # Avoid constant input errors
        if df[item_col].std() == 0 or rest_scores.std() == 0:
            return 0.0
            
        correlation = df[item_col].corr(rest_scores)
        return 0.0 if np.isnan(correlation) else correlation

    def get_weight_modifier(self, difficulty: float, discrimination: float) -> float:
        """
        Determines the weight multiplier for an item based on its stats.
        
        Logic:
        - Higher Discrimination -> Higher Weight (It's a good question).
        - High Difficulty (Low p) -> Higher Weight (Reward solving hard problems).
        - Low Difficulty (High p) -> Lower Weight (It's an easy win).
        """
        # Base multiplier
        multiplier = 1.0
        
        # diff_factor:
        # If p < 0.3 (Hard): +10%
        # If p > 0.8 (Easy): -10%
        if difficulty < 0.3:
            multiplier += 0.1
        elif difficulty > 0.8:
            multiplier -= 0.1
            
        # disc_factor:
        # If r > 0.4 (Excellent): +10%
        # If r < 0.1 (Poor): -10%
        if discrimination > 0.4:
            multiplier += 0.1
        elif discrimination < 0.1:
            multiplier -= 0.1
            
        return max(0.5, min(1.5, multiplier)) # Cap between 0.5x and 1.5x
