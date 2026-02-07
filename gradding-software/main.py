import sys
import os
import argparse
from rich.console import Console
from rich.panel import Panel

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import config
from src.loader import DataLoader
from src.stats import StatsEngine
from src.grader import GradingEngine
from src.reporter import Reporter

console = Console()

def main():
    parser = argparse.ArgumentParser(description="Hybrid Adaptive Grading System Details")
    parser.add_argument("input_file", help="Path to the input CSV file containing student grades.")
    args = parser.parse_args()
    
    input_path = args.input_file
    output_path = config.OUTPUT_FILENAME
    
    console.print(Panel.fit("[bold blue]Hybrid Adaptive Grading System[/bold blue]", subtitle="Initializing..."))
    
    try:
        # 1. Load Data
        console.print(f"[bold]Step 1:[/bold] Loading data from {input_path}...")
        loader = DataLoader(config)
        df_raw = loader.load_data(input_path)
        df_clean = loader.validate_schema(df_raw)
        console.print(f"[green]Data loaded successfully. {len(df_clean)} records found.[/green]")
        
        # 2. Grading Engine (Includes Stats Calculation)
        console.print("[bold]Step 2:[/bold] Running Statistical Weighting & Grading Engine...")
        grader = GradingEngine(config)
        
        # This calculates difficulty/discrimination and applies all rules
        results_df = grader.calculate_composite_score(df_clean)
        console.print("[green]Grading logic applied.[/green]")
        
        # 3. Reporting
        console.print("[bold]Step 3:[/bold] Generating Report...")
        reporter = Reporter(config)
        
        # Scale to final grade
        final_df = reporter.generate_report(results_df, output_path)
        
        # Print summary
        reporter.print_summary(final_df)
        
        console.print(Panel.fit(f"[bold green]Process Complete![/bold green]\nOutput saved to: {output_path}"))
        
    except Exception as e:
        console.print(f"[bold red]FATAL ERROR:[/bold red] {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
