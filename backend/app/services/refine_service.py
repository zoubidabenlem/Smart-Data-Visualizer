import pandas as pd
from typing import List, Tuple, Dict, Any
from app.schemas.refine_schema import ColumnRefineAction, RefinedColumnInfo

def apply_refine_transformations(df: pd.DataFrame, actions: List[ColumnRefineAction]) -> Tuple[pd.DataFrame, List[RefinedColumnInfo]]:
    """
    Apply drop, rename, and dtype overrides in the correct order.
    Returns (transformed_df, list_of_refined_columns_info).
    """
    # 1. Validate all original column names exist
    original_columns = set(df.columns)
    for action in actions:
        if action.original_name not in original_columns:
            raise ValueError(f"Column '{action.original_name}' not found in dataset")

    # 2. Build drop list and rename mapping
    drop_cols = [a.original_name for a in actions if a.action == 'drop']
    rename_map = {}
    for a in actions:
        if a.action in ('keep', 'rename') and a.new_name:
            rename_map[a.original_name] = a.new_name

    # 3. Apply drop and rename (drop first to avoid renaming dropped columns)
    df = df.drop(columns=drop_cols, errors='ignore')
    df = df.rename(columns=rename_map)

    # 4. Type overrides (after rename, using the new column names)
    # Build mapping from final column name → override dtype
    override_map = {}
    for a in actions:
        if a.action in ('keep', 'rename') and a.override_dtype:
            new_name = rename_map.get(a.original_name, a.original_name)
            override_map[new_name] = a.override_dtype

    for col, dtype in override_map.items():
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

    # 5. Build refined column info (final name and pandas dtype)
    refined_info = []
    for col in df.columns:
        dtype_str = str(df[col].dtype)
        refined_info.append(RefinedColumnInfo(name=col, dtype=dtype_str))

    return df, refined_info


def get_refined_cache_key(dataset_id: int) -> str:
    return f"refined:{dataset_id}"