from http.client import HTTPException
from pathlib import Path

import pandas as pd
from typing import List, Tuple, Dict, Any
from app.schemas.refine_schema import ColumnRefineAction, RefinedColumnInfo
from app.models.dataset import SourceType

#DEPRACATED MONOLITH BATCH OPERATION
def apply_refine_transformations(df: pd.DataFrame, actions: List[ColumnRefineAction]) -> Tuple[pd.DataFrame, List[RefinedColumnInfo]]:
    """
    Apply drop, rename, and dtype overrides in the correct order.
    added missing and deduplicate.
    Returns (transformed_df, list_of_refined_columns_info).
    """
    # 1. Validate all original column names exist
    original_columns = set(df.columns)
    for action in actions:
        if action.original_name and action.original_name not in original_columns:
            raise ValueError(f"Column '{action.original_name}' not found in dataset")

    # 2. Build drop list and rename mapping
     # 2. Separate actions
    drop_cols = [a.original_name for a in actions if a.action == 'drop']
    rename_map = {a.original_name: a.new_name for a in actions if a.action in ('keep','rename') and a.new_name}
    dtype_overrides = {}   # final name -> dtype
    for a in actions:
        if a.action in ('keep','rename') and a.override_dtype:
            new_name = rename_map.get(a.original_name, a.original_name)
            dtype_overrides[new_name] = a.override_dtype

    missing_actions = [a for a in actions if a.action == 'missing']
    dedup_action = next((a for a in actions if a.action == 'deduplicate'), None)

    # 3. Apply drop and rename (drop first to avoid renaming dropped columns)
    df = df.drop(columns=drop_cols, errors='ignore')
    df = df.rename(columns=rename_map)

    # 4. Type overrides (after rename, using the new column names)
    # Build mapping from final column name → override dtype
    for col, dtype in dtype_overrides.items():
        if col not in df.columns:
            continue
        try:
            if dtype == 'float':
                df[col] = pd.to_numeric(df[col], errors='coerce')
            elif dtype == 'int':
                df[col] = pd.to_numeric(df[col], errors='coerce', downcast='integer')
            elif dtype == 'datetime':
                df[col] = pd.to_datetime(df[col], errors='coerce')
            elif dtype == 'string':
                df[col] = df[col].astype('string')
        except Exception as e:
            raise ValueError(f"Failed to convert column '{col}' to {dtype}: {str(e)}")

    #4.5 MERGE
     # -- NEW: 3.1 Merge columns (placed after dtype overrides) --
    merge_action = next((a for a in actions if a.action == 'merge'), None)
    if merge_action:
        params = merge_action.parameters
        # Map source columns to their new names (in case they were renamed)
        source_new_names = [rename_map.get(c, c) for c in params.source_columns]
        target_col = params.target_column
        sep = params.separator
        drop_sources = params.drop_sources

        # Verify all source columns exist after rename
        missing = [c for c in source_new_names if c not in df.columns]
        if missing:
            raise ValueError(f"Source columns not found after rename: {missing}")

        # Convert all source columns to string, filling NaN with empty string
        cols = [df[c].fillna('').astype(str) for c in source_new_names]

        # Concatenate
        merged = cols[0]
        for col in cols[1:]:
            merged = merged.str.cat(col, sep=sep)

        # If target column already exists (and is not one of the sources we are dropping),
        # this would be an error – we already validated target doesn’t clash with existing columns,
        # except when it's one of the sources itself. For safety, we just overwrite/update.
        df[target_col] = merged

        if drop_sources:
            # Drop all source columns that are not the target column
            cols_to_drop = [c for c in source_new_names if c != target_col]
            df = df.drop(columns=cols_to_drop, errors='ignore')
        # If target_col is one of the sources and we don’t drop it, the original column is replaced with merged content.
        # This is fine.

    # 5. Missing value handling (per column)
    for ma in missing_actions:
        col = rename_map.get(ma.original_name, ma.original_name)
        if col not in df.columns:
            continue   # should not happen if validated, but safe
        strategy = ma.missing_strategy

        if strategy == 'drop':
            df = df.dropna(subset=[col])
        elif strategy == 'fill':
            if ma.missing_fill_value is None:
                raise ValueError(f"missing_fill_value required for column '{col}' with strategy 'fill'")
            # Attempt to coerce fill value to the column’s dtype
            fill_val = ma.missing_fill_value
            try:
                # More robust: use df[col].dtype.type(fill_val) if possible
                fill_val = df[col].dtype.type(fill_val)
            except (ValueError, TypeError):
                # fallback: keep as string, pandas will handle during fillna
                pass
            df[col] = df[col].fillna(fill_val)
        elif strategy == 'mean':
            if not pd.api.types.is_numeric_dtype(df[col]):
                raise ValueError(f"Column '{col}' must be numeric for strategy '{strategy}'")
            df[col] = df[col].fillna(df[col].mean())
            
        else:
            raise ValueError(f"Unknown missing strategy: {strategy}")

    # 6. Deduplicate
    if dedup_action:
        # Map original subset names to new column names
        subset_original = dedup_action.subset
        subset_new = [rename_map.get(c, c) for c in subset_original]
        missing_cols = [c for c in subset_new if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Columns in deduplicate subset not found: {missing_cols}")
        keep = dedup_action.keep
        df = df.drop_duplicates(subset=subset_new, keep=keep)

    # 7. Build refined column info
    refined_info = [
        RefinedColumnInfo(name=col, dtype=str(df[col].dtype))
          for col in df.columns]

    return df, refined_info


def get_refined_cache_key(dataset_id: int) -> str:
    return f"refined:{dataset_id}"


# In-memory cache for the original DataFrame (before any refinement)
original_df_cache: dict = {}          # simple dict; use TTLCache if you prefer memory‑bound

def get_original_df(dataset) -> pd.DataFrame:
    """Return the original DataFrame, cached in memory after first read."""
    dataset_id = dataset.id
    if dataset_id in original_df_cache:
        return original_df_cache[dataset_id]

    file_path = Path(str(dataset.source_path))
    if not file_path.exists():
        raise HTTPException(400, "Dataset file missing")

    if dataset.source_type == SourceType.csv:
        try:
            df = pd.read_csv(file_path, encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding="latin-1")
    elif dataset.source_type == SourceType.excel:
        df = pd.read_excel(file_path)
    else:
        raise HTTPException(400, "Unsupported source type")

    original_df_cache[dataset_id] = df
    return df

# SEQUENTIAL REFINE PIPELINE
def apply_refine_pipeline(df: pd.DataFrame, actions: List[ColumnRefineAction]) -> pd.DataFrame:
    """
    Apply a list of refinement actions sequentially, using current column names.
    Raises ValueError with a descriptive message if any action fails.
    """
    for idx, action in enumerate(actions):
        try:
            df = _apply_single_action(df, action, idx)
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Step {idx+1} ({action.action}): {str(e)}")
    return df

def _apply_single_action(df: pd.DataFrame, action: ColumnRefineAction, step: int) -> pd.DataFrame:
    act = action.action
    col = action.original_name  # current column name for drop/rename/keep/missing
    new_name = action.new_name
    override_dtype = action.override_dtype
    params = action.parameters

    # ------ DROP ------
    if act == "drop":
        if col not in df.columns:
            raise ValueError(f"Step {step+1}: column '{col}' not found for drop")
        return df.drop(columns=[col])

    # ------ RENAME ------
    elif act == "rename":
        if col not in df.columns:
            raise ValueError(f"Step {step+1}: column '{col}' not found for rename")
        if not new_name:
            raise ValueError(f"Step {step+1}: 'new_name' is required for rename")
        df = df.rename(columns={col: new_name})
        # dtype override after rename
        if override_dtype:
            df = _convert_dtype(df, new_name, override_dtype, step)
        return df

    # ------ MISSING ------
    elif act == "missing":
        if col not in df.columns:
            raise ValueError(f"Step {step+1}: column '{col}' not found for missing")
        strategy = action.missing_strategy
        if not strategy:
            raise ValueError(f"Step {step+1}: missing_strategy required")
        # dtype override first (useful to coerce to numeric for 'mean')
        if override_dtype:
            df = _convert_dtype(df, col, override_dtype, step)
        if strategy == "drop":
            df = df.dropna(subset=[col])
        elif strategy == "fill":
            fill_val = action.missing_fill_value
            if fill_val is None:
                raise ValueError(f"Step {step+1}: missing_fill_value required for strategy 'fill'")
            # Try to coerce the fill value to the column's dtype
            try:
                fill_val = df[col].dtype.type(fill_val)
            except (ValueError, TypeError):
                pass  # keep as given; pandas will attempt conversion
            df[col] = df[col].fillna(fill_val)
        elif strategy == "mean":
            if not pd.api.types.is_numeric_dtype(df[col]):
                raise ValueError(f"Step {step+1}: column '{col}' is not numeric, cannot use 'mean' strategy")
            df[col] = df[col].fillna(df[col].mean())
        else:
            raise ValueError(f"Step {step+1}: unknown missing strategy '{strategy}'")
        return df

    # ------ MERGE ------
    elif act == "merge":
        if not params:
            raise ValueError(f"Step {step+1}: parameters required for merge")
        source_cols = params.source_columns
        target_col = params.target_column
        sep = params.separator
        drop_sources = params.drop_sources

        # All source columns must exist
        missing = [c for c in source_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Step {step+1}: source columns not found: {missing}")
        # If target column already exists and is not a source column, error
        if target_col in df.columns and target_col not in source_cols:
            raise ValueError(f"Step {step+1}: target column '{target_col}' already exists and is not a source column")

        # Build merged series
        cols = [df[c].fillna('').astype(str) for c in source_cols]
        merged = cols[0]
        for c in cols[1:]:
            merged = merged.str.cat(c, sep=sep)

        df[target_col] = merged

        if drop_sources:
            cols_to_drop = [c for c in source_cols if c != target_col]
            df = df.drop(columns=cols_to_drop, errors='ignore')
        return df

    # ------ DEDUPLICATE ------
    elif act == "deduplicate":
        subset = action.subset
        keep = action.keep
        if not subset:
            raise ValueError(f"Step {step+1}: subset required for deduplicate")
        missing = [c for c in subset if c not in df.columns]
        if missing:
            raise ValueError(f"Step {step+1}: columns in subset not found: {missing}")
        return df.drop_duplicates(subset=subset, keep=keep or "first")

    else:
        raise ValueError(f"Step {step+1}: unknown action '{act}'")


def _convert_dtype(df: pd.DataFrame, col: str, dtype: str, step: int) -> pd.DataFrame:
    """In-place dtype conversion helper. Raises ValueError if conversion fails."""
    try:
        if dtype == "float":
            df[col] = pd.to_numeric(df[col], errors="raise")
        elif dtype == "int":
            df[col] = pd.to_numeric(df[col], errors="raise", downcast="integer")
        elif dtype == "datetime":
            df[col] = pd.to_datetime(df[col], errors="raise")
        elif dtype == "string":
            df[col] = df[col].astype("string")
        else:
            raise ValueError(f"Unsupported dtype '{dtype}'")
    except Exception as e:
        raise ValueError(f"Step {step+1}: cannot convert column '{col}' to {dtype}: {str(e)}")
    return df