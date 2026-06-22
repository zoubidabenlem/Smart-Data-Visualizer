import pandas as pd
from typing import List, Tuple, Dict, Any
from app.schemas.refine_schema import ColumnRefineAction, RefinedColumnInfo

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