#!/usr/bin/env python3
"""
test_pipeline_sample.py
Script to run the data cleaning pipeline on a sample of rows
and compare the before / after state.
"""

import argparse
import pandas as pd
import sys
import json
from pathlib import Path

# Adjust imports to match your project structure
from app.services.pipeline.orchestrator import run_pipeline
from app.schemas.pipeline import PrepareRequest, FilterCondition


def main():
    parser = argparse.ArgumentParser(description="Test data cleaning pipeline on a sample of rows")
    parser.add_argument("--input", "-i", required=True, help="Path to input CSV file")
    parser.add_argument("--rows", "-n", type=int, default=20, help="Number of sample rows (default: 20)")
    parser.add_argument("--output", "-o", default=None, help="Optional output prefix for JSON files")
    parser.add_argument("--strategy", default="mean", choices=["drop", "fill", "mean"],
                        help="Missing value strategy (default: mean)")
    parser.add_argument("--fillvalue", type=float, default=None, help="Fill value when strategy=fill")
    parser.add_argument("--filtercol", default=None, help="Optional filter column")
    parser.add_argument("--filterop", default=None, choices=[">", "<", "==", "!=", "in", "like"],
                        help="Filter operator")
    parser.add_argument("--filterval", default=None, help="Filter value (comma-separated for 'in')")
    parser.add_argument("--groupby", nargs="+", default=None, help="Columns to group by")
    parser.add_argument("--aggfunc", default=None, choices=["SUM", "MEAN", "COUNT"], help="Aggregation function")
    parser.add_argument("--valuecol", default=None, help="Value column for aggregation")
    args = parser.parse_args()

    # 1. Read the dataset
    print(f"Reading {args.input}...")
    df = pd.read_csv(args.input)
    print(f"Loaded {len(df)} rows, {len(df.columns)} columns.")

    # 2. Build the pipeline configuration
    filters = None
    if args.filtercol and args.filterop and args.filterval is not None:
        val = args.filterval
        # Convert value type if possible (simple auto‑detect)
        if args.filterop == "in":
            val = [v.strip() for v in val.split(",")]
        elif args.filterop in [">", "<", "==", "!="]:
            try:
                val = float(val)
            except ValueError:
                pass  # keep as string
        filters = [FilterCondition(column=args.filtercol, operator=args.filterop, value=val)]

    params = PrepareRequest(
        missing_strategy=args.strategy,
        fill_value=args.fillvalue,
        filters=filters or [],
        group_by=args.groupby,
        agg_func=args.aggfunc,
        value_col=args.valuecol,
    )

    # 3. Select sample rows (before)
    n_sample = min(args.rows, len(df))
    sample_indices = df.head(n_sample).index
    before_sample = df.loc[sample_indices].copy()

    # 4. Run the pipeline on the complete dataset
    print(f"Running pipeline with strategy '{args.strategy}'...")
    clean_records = run_pipeline(df, params)  # returns list of dicts (JSON-safe)
    df_clean = pd.DataFrame(clean_records)

    # 5. Extract the same rows from the cleaned DataFrame
    #    Some rows might be dropped entirely – align by intersection of indices
    after_sample_indices = sample_indices.intersection(df_clean.index)
    after_sample = df_clean.loc[after_sample_indices].copy()
    before_sample = before_sample.loc[after_sample_indices]  # align

    # 6. Output comparison
    if args.output:
        prefix = args.output
        before_sample.to_json(f"{prefix}_before.json", orient="records", indent=2)
        after_sample.to_json(f"{prefix}_after.json", orient="records", indent=2)
        print(f"Saved before/after JSON to '{prefix}_before.json' and '{prefix}_after.json'")

    # Print to console as well
    print("\n--- BEFORE (raw sample) ---")
    print(before_sample.to_string())
    print("\n--- AFTER (cleaned sample) ---")
    print(after_sample.to_string())


if __name__ == "__main__":
    main()