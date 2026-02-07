import pandas as pd
import numpy as np
from rich.console import Console

console = Console()

class DataLoader:
    """Handles loading and validation of student data."""

    def __init__(self, config):
        """
        Args:
            config: The configuration module.
        """
        self.config = config

    def load_data(self, filepath: str) -> pd.DataFrame:
        """
        Loads CSV data, cleans headers, and handles missing values.
        
        Args:
            filepath: Path to the CSV file.
            
        Returns:
            pd.DataFrame: Cleaned dataframe.
        """
        try:
            df = pd.read_csv(filepath)
            # Strip whitespace from headers
            df.columns = df.columns.str.strip()
            
            # Basic cleaning: Fill NaN with 0 for numeric columns (except ID/Name)
            # We will handle specific column validation later, but this is a safe default for grades
            # numeric_cols = df.select_dtypes(include=[np.number]).columns
            # df[numeric_cols] = df[numeric_cols].fillna(0)
             # Better approach: fillna(0) only on mapped columns to avoid messing up metadata
             
            return df
        except FileNotFoundError:
            console.print(f"[bold red]Error:[/bold red] File not found at {filepath}")
            raise
        except Exception as e:
            console.print(f"[bold red]Error loading CSV:[/bold red] {e}")
            raise

    def validate_schema(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Ensures all columns defined in config.COLUMN_MAPPING exist in the dataframe.
        Renames columns to internal IDs for easier processing.
        
        Args:
            df: The raw dataframe.
            
        Returns:
            pd.DataFrame: Dataframe with internal column names.
        """
        mapping = self.config.COLUMN_MAPPING
        
        missing_cols = []
        flat_map = {} # Internal -> CSV Header

        # 1. Base Identifiers
        flat_map["student_id"] = mapping["student_id"]
        flat_map["name"] = mapping["name"]
        
        # 2. Unweighted Activities (formerly Attendance)
        # Mapping is a dict: { "internal_id": "CSV Header" }
        for k, v in mapping["unweighted"].items():
             flat_map[k] = v 
             
        # 3. Quizzes (Now a single string)
        # Internal key will be "quizzes_consolidated" or just "quizzes" 
        # But wait, config has keys equal to the map keys?
        # Let's map internal "quizzes" to the config value.
        flat_map["quizzes"] = mapping["quizzes"]
             
        # 4. Assignments (Dict)
        for k, v in mapping["assignments"].items():
             flat_map[k] = v 
             
        # 5. Internal Exam (String)
        flat_map["internal_exam"] = mapping["internal_exam"]

        # Check for missing columns
        for internal, csv_header in flat_map.items():
            if csv_header not in df.columns:
                missing_cols.append(csv_header)
                
        if missing_cols:
            console.print(f"[bold red]Critical Error:[/bold red] The following columns are missing from the CSV: {missing_cols}")
            raise ValueError(f"Missing columns: {missing_cols}")

        # Rename columns to internal names
        # Invert the map: csv_header -> internal
        rename_map = {v: k for k, v in flat_map.items()}
        df_renamed = df.rename(columns=rename_map)
        
        # Fill NaNs with 0 for all graded columns (everything except name/id)
        cols_to_fill = [c for c in df_renamed.columns if c not in ["student_id", "name"]]
        df_renamed[cols_to_fill] = df_renamed[cols_to_fill].fillna(0)
        
        # Ensure numeric types
        for col in cols_to_fill:
             df_renamed[col] = pd.to_numeric(df_renamed[col], errors='coerce').fillna(0)
            
        return df_renamed

