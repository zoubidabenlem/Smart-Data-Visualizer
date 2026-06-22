# app/services/pipeline/validation.py
from typing import List, Dict, Any, Optional
import pandas as pd
from app.schemas.pipeline import MissingConfig, MissingOverride

# Custom exception for structured validation errors
class PipelineValidationError(ValueError):
    """
    Custom exception that holds a list of field‑level error dictionaries.
    Each error dict has keys: "field" (e.g., "filters[0].column"), "msg" (human-readable).
    """
    def __init__(self, errors: List[Dict[str, Any]]):
        self.errors = errors
        super().__init__(str(errors))

# NEW: Helper to build field prefix for filter indices
def _field_prefix(field_base: str, idx: int) -> str:
    return f"{field_base}[{idx}]"

# NEW: Helper to safely check numeric dtype (handles None)
def _is_numeric_dtype(dtype: Any) -> bool:
    """Safely check if dtype is numeric, returns False if None or invalid."""
    if dtype is None:
        return False
    return pd.api.types.is_numeric_dtype(dtype)

# NEW: Validate a single filter condition
def _validate_filter_condition(
    filter_cond: Any,
    idx: int,
    dataset_columns: List[str],
    column_dtypes: Dict[str, Any]
) -> None:
    prefix = _field_prefix("filters", idx)
    col = filter_cond.column

    # Existence
    if col not in dataset_columns:
        raise PipelineValidationError([{"field": f"{prefix}.column", "msg": f"Column '{col}' not found."}])

    dtype = column_dtypes.get(col)  # might be None if column somehow missing, but we validated existence
    op = filter_cond.operator
    val = filter_cond.value

    # Operator-specific constraints
    if op in (">", "<", ">=", "<="):
        # FIX: Use helper that returns False for None
        if not _is_numeric_dtype(dtype):
            raise PipelineValidationError([{"field": f"{prefix}.operator", "msg": f"Operator '{op}' requires a numeric column; '{col}' is not numeric."}])
        if not isinstance(val, (int, float)):
            raise PipelineValidationError([{"field": f"{prefix}.value", "msg": f"Value must be a number for operator '{op}'."}])
    elif op == "==":
        # Equality works with any type
        pass
    elif op == "in":
        if not isinstance(val, list):
            raise PipelineValidationError([{"field": f"{prefix}.value", "msg": "'in' operator requires a list value."}])
        # Optional: check list elements are compatible with column type
        if _is_numeric_dtype(dtype) and not all(isinstance(v, (int, float)) for v in val):
            raise PipelineValidationError([{"field": f"{prefix}.value", "msg": f"All values in the list must be numeric for column '{col}'."}])
    elif op == "like":
        if not isinstance(val, str):
            raise PipelineValidationError([{"field": f"{prefix}.value", "msg": "'like' operator requires a string value."}])
    else:
        raise PipelineValidationError([{"field": f"{prefix}.operator", "msg": f"Unsupported operator '{op}'."}])

# NEW: Validate filters list
def validate_filters(
    filters: Optional[List[Any]],
    dataset_columns: List[str],
    column_dtypes: Dict[str, Any]
) -> None:
    """Validate each filter condition. Raises PipelineValidationError if any issue."""
    if not filters:
        return
    for idx, f in enumerate(filters):
        _validate_filter_condition(f, idx, dataset_columns, column_dtypes)

# NEW: Validate aggregation parameters
def validate_aggregation(
    group_by: Optional[List[str]],
    agg_func: Optional[str],
    value_col: Optional[str],
    dataset_columns: List[str],
    column_dtypes: Dict[str, Any]
) -> None:
    """
    Validate aggregation parameters.
    Cases:
      - No aggregation: group_by, agg_func, value_col all None/empty.
      - Global aggregation: agg_func and value_col provided, group_by is None or empty list.
      - Grouped aggregation: all three provided with non-empty group_by.
    """
    # No aggregation requested
    if not group_by and not agg_func and not value_col:
        return

    # Global aggregation: agg_func and value_col present, group_by missing/empty
    if (agg_func and value_col) and (not group_by or len(group_by) == 0):
        # Global aggregation is valid – skip group_by checks
        pass
    # Grouped aggregation: all three must be non-empty
    elif group_by and agg_func and value_col:
        # Group-by columns existence
        for col in group_by:
            if col not in dataset_columns:
                raise PipelineValidationError([{"field": "aggregation.group_by", "msg": f"Group by column '{col}' not found."}])
        # Value column existence
        if value_col not in dataset_columns:
            raise PipelineValidationError([{"field": "aggregation.value_col", "msg": f"Value column '{value_col}' not found."}])
        # Self-grouping check
        if value_col in group_by:
            raise PipelineValidationError([{"field": "aggregation.group_by", "msg": "value_col cannot be part of group_by columns."}])
    else:
        raise PipelineValidationError([{"field": "aggregation", "msg": "If aggregation is used, provide agg_func and value_col; optionally group_by for grouped aggregation."}])

    # Numeric requirement for SUM, MEAN, MIN, MAX
    if agg_func in ("SUM", "MEAN", "MIN", "MAX"):
        dtype = column_dtypes.get(value_col)
        if not _is_numeric_dtype(dtype):
            raise PipelineValidationError([{"field": "aggregation.value_col", "msg": f"Column '{value_col}' must be numeric for {agg_func}."}])
    elif agg_func not in ("COUNT",):
        raise PipelineValidationError([{"field": "aggregation.agg_func", "msg": f"Unsupported aggregation function: {agg_func}. Supported: COUNT, SUM, MEAN, MIN, MAX."}])
# In validation.py, after validate_aggregation

def validate_missing_config(config: MissingConfig, dataset_columns: List[str], column_dtypes: Dict[str, Any]) -> None:
    """
    Validate MissingConfig:
        - Overrides reference existing columns.
        - If override strategy is 'fill', fill_value must be provided and type‑compatible.
    """
    if not config.overrides:
        return

    for col, override in config.overrides.items():
        if col not in dataset_columns:
            raise PipelineValidationError([{"field": f"missing_config.overrides.{col}", "msg": f"Column '{col}' not found."}])

        if isinstance(override, MissingOverride) and override.strategy == "fill":
            if override.fill_value is None:
                raise PipelineValidationError([{"field": f"missing_config.overrides.{col}.fill_value", "msg": f"fill_value is required for column '{col}' with 'fill' strategy."}])

            dtype = column_dtypes.get(col)
            if pd.api.types.is_numeric_dtype(dtype) and not isinstance(override.fill_value, (int, float)): # type: ignore
                raise PipelineValidationError([{"field": f"missing_config.overrides.{col}.fill_value", "msg": f"Column '{col}' is numeric; fill_value must be a number."}])
            
# refinement validation

def validate_refine_missing(
    missing_actions: List[Any],
    dataset_columns: List[str],
    column_dtypes: Dict[str, Any]
) -> None:
    """
    Validate missing actions from a refine request.
    Each missing action must:
      - Reference an existing column
      - Provide missing_strategy
      - If strategy is 'fill', missing_fill_value must be present and type‑compatible
    """
    if not missing_actions:
        return
    for ma in missing_actions:
        col = ma.original_name
        if col not in dataset_columns:
            raise PipelineValidationError([{
                "field": f"columns[missing].original_name",
                "msg": f"Column '{col}' not found."
            }])
        if ma.missing_strategy == "fill":
            if ma.missing_fill_value is None:
                raise PipelineValidationError([{
                    "field": f"columns[missing].missing_fill_value",
                    "msg": f"fill_value is required for column '{col}' with 'fill' strategy."
                }])
            dtype = column_dtypes.get(col)
            if pd.api.types.is_numeric_dtype(dtype) and not isinstance(ma.missing_fill_value, (int, float)):
                raise PipelineValidationError([{
                    "field": f"columns[missing].missing_fill_value",
                    "msg": f"Column '{col}' is numeric; fill_value must be a number."
                }])

def validate_refine_deduplicate(
    dedup_action: Any,
    dataset_columns: List[str]
) -> None:
    """Validate a single deduplicate action."""
    if dedup_action is None:
        return
    # Subset required and non‑empty (already checked by Pydantic)
    for col in dedup_action.subset:
        if col not in dataset_columns:
            raise PipelineValidationError([{
                "field": "columns[deduplicate].subset",
                "msg": f"Column '{col}' not found."
            }])