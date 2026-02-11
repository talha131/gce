import pandas as pd
from rich.table import Table
from rich.console import Console

console = Console()

class Reporter:
    """
    Handles report generation and visualization.
    """

    def __init__(self, config):
        self.config = config

    def scale_score(self, raw_score: float) -> float:
        """
        Scales the raw score to the target max (FINAL_SCALED_SCORE_MAX).
        """
        # Calculate theoretical max
        # We need to sum the max possible points for all *Graded* activities.
        # This excludes "Unweighted" if their mode is Additive (Bonus).
        
        # We iterate over MAX_SCORES, BUT we need to be careful not to include extraneous keys
        # or include Unweighted keys if they are there.
        # The safest way is to rebuild the theoretical max from the active mapping.
        
        theoretical_max = 0.0
        
        # 1. Quizzes
        # Config key: "quizzes" (Internal ID)
        theoretical_max += self.config.MAX_SCORES.get("quizzes", 0)
        
        # 2. Assignments
        for a_key in self.config.COLUMN_MAPPING["assignments"].keys():
            theoretical_max += self.config.MAX_SCORES.get(a_key, 0)
            
        # 3. Internal Exam
        theoretical_max += self.config.MAX_SCORES.get("internal_exam", 0)
        
        # Note: Unweighted are ignored in denominator (Additive Bonus)
        
        if theoretical_max == 0:
            return 0.0
            
        scaled = (raw_score / theoretical_max) * self.config.FINAL_SCALED_SCORE_MAX
        return min(self.config.FINAL_SCALED_SCORE_MAX, scaled) # Cap at max

    def generate_report(self, results_df: pd.DataFrame, output_path: str):
        """
        Calculates final scaled scores and saves to CSV.
        """
        # Determine scaling denominator
        # We can use the max score achieved in the class as the '100%' mark (curving),
        # or a hardcoded theoretical max. 
        # Let's stick effectively to absolute scaling for now to be safe, unless max achieved is used.
        # Ideally, we should calculate the theoretical max possible points students could get.
        
        # Apply scaling
        results_df["final_scaled_grade"] = results_df["raw_total"].apply(lambda x: self.scale_score(x))
        results_df["final_scaled_grade"] = results_df["final_scaled_grade"].round(2)
        
        # Save
        results_df.to_csv(output_path, index=False)
        console.print(f"[bold green]Successfully saved grades to {output_path}[/bold green]")
        
        return results_df

    def print_summary(self, df: pd.DataFrame):
        """
        Prints a summary table to the terminal.
        """
        table = Table(title="Grade Distribution Summary")

        table.add_column("Metric", style="cyan", no_wrap=True)
        table.add_column("Value", style="magenta")

        grades = df["final_scaled_grade"]
        
        table.add_row("Mean", f"{grades.mean():.2f}")
        table.add_row("Median", f"{grades.median():.2f}")
        table.add_row("Std Dev", f"{grades.std():.2f}")
        table.add_row("Min", f"{grades.min():.2f}")
        table.add_row("Max", f"{grades.max():.2f}")
        
        console.print(table)
