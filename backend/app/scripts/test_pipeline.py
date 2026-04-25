#!/usr/bin/env python3
"""
End-to-end pipeline test script.
Compares data before and after refinement to check cleaning efficiency.

Usage:
    python test_pipeline.py --file path/to/data.csv --rows 500
    python test_pipeline.py --file data.xlsx --rows 1000 --refine-config refine.json
"""

import argparse
import json
import sys
import tempfile
import os
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, List
import sys
print("Script started", flush=True)
# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
BASE_URL = "http://localhost:8000"
DEFAULT_EMAIL = "admin@example.com"   # data
DEFAULT_PASSWORD = "admin123"

# ----------------------------------------------------------------------
# Helper functions
# ----------------------------------------------------------------------
def login(session: requests.Session, base_url: str, email: str, password: str) -> str:
    """Log in and return the JWT token."""
    resp = session.post(f"{base_url}/auth/login", json={
        "email": email,
        "password": password
    })
    resp.raise_for_status()
    token = resp.json().get("access_token")
    if not token:
        raise RuntimeError("Login did not return a token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    return token

def upload_file(session: requests.Session, base_url: str, file_path: str) -> int:
    """Upload a file and return the dataset ID."""
    filename = os.path.basename(file_path)

    # Determine the correct MIME type
    if filename.endswith('.csv'):
        mime_type = 'text/csv'
    elif filename.endswith('.xlsx'):
        mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    elif filename.endswith('.xls'):
        mime_type = 'application/vnd.ms-excel'
    else:
        mime_type = 'text/csv'   # safe default

    with open(file_path, "rb") as f:
        resp = session.post(
            f"{base_url}/datasets/upload",
            files={"file": (filename, f, mime_type)}
        )
    resp.raise_for_status()
    return resp.json()["id"]

def get_preview(session: requests.Session, base_url: str, dataset_id: int) -> List[Dict[str, Any]]:
    """Get the (possibly refined) preview as a list of dicts."""
    resp = session.get(f"{base_url}/datasets/{dataset_id}/preview")
    resp.raise_for_status()
    return resp.json()["data"]

def refine_dataset(session: requests.Session, base_url: str, dataset_id: int, payload: Dict[str, Any]):
    """Apply schema refinement."""
    resp = session.post(f"{base_url}/datasets/{dataset_id}/refine-schema", json=payload)
    resp.raise_for_status()
    return resp.json()

def prepare_dataset(session: requests.Session, base_url: str, dataset_id: int, payload: Dict[str, Any]) -> Dict:
    """Run the preparation pipeline (returns chart data)."""
    resp = session.post(f"{base_url}/datasets/{dataset_id}/prepare", json=payload)
    if resp.status_code != 200:
        print("Prepare failed with:", resp.status_code)
        print("Response detail:", resp.text[:1000])   # <-- ADD THIS
    resp.raise_for_status()
    return resp.json()

def compare_previews(before: List[Dict], after: List[Dict]) -> str:
    """
    Compare two previews (list of dicts) and return a readable report.
    """
    df_before = pd.DataFrame(before)
    df_after = pd.DataFrame(after)

    report = []
    report.append("=" * 60)
    report.append("COMPARISON: BEFORE vs AFTER REFINEMENT")
    report.append("=" * 60)

    # Column count
    before_cols = set(df_before.columns)
    after_cols = set(df_after.columns)
    removed_cols = before_cols - after_cols
    added_cols = after_cols - before_cols
    common_cols = before_cols & after_cols

    report.append(f"Rows before   : {len(df_before)}")
    report.append(f"Rows after    : {len(df_after)}")
    report.append(f"Columns before: {len(before_cols)}")
    report.append(f"Columns after : {len(after_cols)}")
    if removed_cols:
        report.append(f"Removed cols  : {sorted(removed_cols)}")
    if added_cols:
        report.append(f"Added cols    : {sorted(added_cols)}")

    # Missing values per common column
    report.append("\nMissing values in common columns:")
    for col in sorted(common_cols):
        before_null = df_before[col].isna().sum()
        after_null = df_after[col].isna().sum()
        if before_null != after_null:
            report.append(f"  {col}: {before_null} → {after_null}")

    # Data type changes
    report.append("\nData type changes:")
    for col in sorted(common_cols):
        before_dtype = df_before[col].dtype
        after_dtype = df_after[col].dtype
        if before_dtype != after_dtype:
            report.append(f"  {col}: {before_dtype} → {after_dtype}")

    # Show first few rows that are different (sample)
    report.append("\nSample changed rows (first 5 differing rows):")
    if not df_before.equals(df_after):
        merged = pd.merge(df_before, df_after, how='outer', indicator=True)
        changed_mask = merged['_merge'] != 'both'
        if changed_mask.any():
            sample_idx = merged[changed_mask].index[:5]
            report.append(merged.loc[sample_idx].to_string())
    else:
        report.append("  (No changes in preview rows)")

    return "\n".join(report)

# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Test pipeline and compare refinement output.")
    parser.add_argument("--file", required=True, help="Path to the dataset (CSV or Excel)")
    parser.add_argument("--rows", type=int, default=500, help="Number of rows to use for testing (default: 500)")
    parser.add_argument("--refine-config", help="JSON file with the refine schema payload")
    parser.add_argument("--prepare-config", help="JSON file with the prepare request payload")
    parser.add_argument("--base-url", default=BASE_URL, help="Base URL of the API")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help="Admin email (used for login)")    
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Admin password")
    parser.add_argument("--output-dir", default="./pipeline_test_output", help="Directory to save results")
    args = parser.parse_args()

    # Create output directory
    outdir = Path(args.output_dir)
    outdir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    
    print("Testing connection to server...")
    try:
        r = session.get(f"{args.base_url}/docs", timeout=5)
        print(f"Server reachable: {r.status_code}")
    except Exception as e:
        print(f"Cannot reach server: {e}")
        sys.exit(1)

    # 1. Login
    print("🔐 Logging in...")
    login(session, args.base_url, args.email, args.password)

    # 2. Create a subset file with the first N rows
    print(f"📄 Reading {args.file} and taking first {args.rows} rows...")
    if args.file.endswith('.csv'):
        df_full = pd.read_csv(args.file, nrows=args.rows)
    else:
        df_full = pd.read_excel(args.file, nrows=args.rows)

    # Save to temporary file for upload
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
    df_full.to_csv(tmp.name, index=False)
    tmp.close()
    print(f"   Temporary file created: {tmp.name}")

    # 3. Upload
    print("☁️ Uploading subset...")
    dataset_id = upload_file(session, args.base_url, tmp.name)
    print(f"   Dataset ID: {dataset_id}")

    # Clean up temp file
    os.unlink(tmp.name)

    # 4. Get original preview
    print("📥 Fetching original preview...")
    before_preview = get_preview(session, args.base_url, dataset_id)
    with open(outdir / f"preview_before_{dataset_id}.json", "w") as f:
        json.dump(before_preview, f, indent=2, default=str)

    # 5. Apply refine if config provided
    after_preview = before_preview  # default to same if no refine
    if args.refine_config:
        print("🔧 Refining schema...")
        with open(args.refine_config) as f:
            refine_payload = json.load(f)
        refine_dataset(session, args.base_url, dataset_id, refine_payload)

        # 6. Get refined preview
        print("📥 Fetching refined preview...")
        after_preview = get_preview(session, args.base_url, dataset_id)
        with open(outdir / f"preview_after_{dataset_id}.json", "w") as f:
            json.dump(after_preview, f, indent=2, default=str)
    else:
        print("⚠️ No refine config provided – skipping refinement. Comparison will be identical.")

    # 7. Compare
    report = compare_previews(before_preview, after_preview)
    print("\n" + report)
    with open(outdir / "comparison_report.txt", "w") as f:
        f.write(report)

    # 8. Optional: run prepare with a default or provided config
    if args.prepare_config:
        print("\n📊 Running data preparation...")
        with open(args.prepare_config) as f:
            prepare_payload = json.load(f)
    else:
        # Try to build a simple prepare payload using the first categorical/numeric column
        print("\n📊 Running data preparation with auto-generated config...")
        df_preview = pd.DataFrame(after_preview)
        # Choose a categorical column (object) for grouping, fallback to first column
        group_col = None
        for col in df_preview.columns:
            if df_preview[col].dtype == object:
                group_col = col
                break
        if group_col is None:
            group_col = df_preview.columns[0] if not df_preview.empty else "column"
        # Build a valid PrepareRequest payload
        prepare_payload = {
            "group_by": [group_col],      # must be a list
            "agg_func": "COUNT",          # must be uppercase: SUM, MEAN, or COUNT
            "filters": []
        }
    result = prepare_dataset(session, args.base_url, dataset_id, prepare_payload)
    print(f"   ✅ Preparation returned {len(result.get('chart_data', []))} chart data rows.")
    with open(outdir / "prepare_result.json", "w") as f:
        json.dump(result, f, indent=2, default=str)

    print(f"\n🎉 Done. Output saved to {outdir}/")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        print("FATAL ERROR:", e, flush=True)
        traceback.print_exc()
        sys.exit(1)