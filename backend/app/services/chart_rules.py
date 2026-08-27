# app/services/chart_rules.py
from typing import List, Dict, Any
from app.schemas.dashboard_schemas import WidgetConfig

# app/services/chart_rules.py

# Include pandas/SQL type variations
NOMINAL_TYPES = {'string', 'boolean', 'date', 'datetime', 'object', 'text', 'varchar'}
QUANTITATIVE_TYPES = {'integer', 'float', 'int64', 'float64', 'int32', 'float32', 'decimal', 'numeric', 'double', 'number'}

def validate_widget_config(config: WidgetConfig, model_metadata: Dict[int, List[Dict[str, str]]]) -> List[str]:
    """
    Validate widget config against chart rules and model metadata.
    
    model_metadata: mapping dataset_id -> list of column dicts: {"name": str, "type": str}
    Returns list of error strings (empty if valid).
    """
    errors = []

    # 1. Ensure all referenced dataset_ids exist in model_metadata
    all_dataset_ids = set()
    for dim in config.dimensions:
        all_dataset_ids.add(dim.dataset_id)
    for meas in config.measures:
        all_dataset_ids.add(meas.dataset_id)
    for filt in config.filters:
        all_dataset_ids.add(filt.dataset_id)

    for ds_id in all_dataset_ids:
        if ds_id not in model_metadata:
            errors.append(f"Dataset {ds_id} is not part of the model")

    # Helper to get column type from metadata
    def get_column_type(dataset_id: int, column: str) -> str | None:
        if dataset_id not in model_metadata:
            return None
        for col_info in model_metadata[dataset_id]:
            if col_info["name"] == column:
                return col_info["type"].lower()  # normalize to lowercase
        return None

    # 2. Validate column existence and collect data types for dimensions/measures
    dimension_types = []   # list of types for dimensions (in order)
    measure_types = []     # list of types for measures (in order)

    for dim in config.dimensions:
        col_type = get_column_type(dim.dataset_id, dim.column)
        if col_type is None:
            errors.append(f"Dimension column '{dim.column}' not found in dataset {dim.dataset_id}")
        else:
            dimension_types.append(col_type)

    for meas in config.measures:
        col_type = get_column_type(meas.dataset_id, meas.column)
        if col_type is None:
            errors.append(f"Measure column '{meas.column}' not found in dataset {meas.dataset_id}")
        else:
            measure_types.append(col_type)

    # If basic column errors exist, skip further validation (or continue, your choice)
    # Here we continue but skip type-specific rules if types are missing
    if not errors:
        # 3. Chart type specific rules with data type checks
        chart = config.chart_type

        # At least one measure or dimension
        if not config.measures and not config.dimensions:
            errors.append("Widget must have at least one dimension or measure")

        # Helper: check if all types are nominal/quantitative
        all_nominal = all(t in NOMINAL_TYPES for t in dimension_types)
        all_quantitative = all(t in QUANTITATIVE_TYPES for t in measure_types)

        if chart in {"bar", "line", "area"}:
            if len(config.dimensions) < 1 or len(config.measures) < 1:
                errors.append(f"{chart} chart requires at least 1 dimension and 1 measure")
            else:
                if not all_nominal:
                    errors.append(f"{chart} chart dimensions must be nominal (string, boolean, date)")
                if not all_quantitative:
                    errors.append(f"{chart} chart measures must be quantitative (integer, float)")

        elif chart == "pie":
            if len(config.dimensions) != 1 or len(config.measures) != 1:
                errors.append("Pie chart requires exactly 1 dimension and 1 measure")
            else:
                if dimension_types[0] not in NOMINAL_TYPES:
                    errors.append("Pie chart dimension must be nominal")
                if measure_types[0] not in QUANTITATIVE_TYPES:
                    errors.append("Pie chart measure must be quantitative")

        elif chart == "scatter":
            # Scatter requires at least 2 measures, and optionally dimensions for coloring
            if len(config.measures) < 2:
                errors.append("Scatter chart requires at least 2 measures")
            else:
                if not all_quantitative:
                    errors.append("Scatter chart measures must be quantitative")
                # If dimensions present, they should be nominal (for color/symbol)
                if config.dimensions and not all_nominal:
                    errors.append("Scatter chart dimensions (if used) must be nominal")

        elif chart == "heatmap":
            if len(config.dimensions) < 2 or len(config.measures) < 1:
                errors.append("Heatmap requires at least 2 dimensions and 1 measure")
            else:
                if not all_nominal:
                    errors.append("Heatmap dimensions must be nominal")
                if not all_quantitative:
                    errors.append("Heatmap measure must be quantitative")

        elif chart == "kpi":
            if len(config.measures) != 1:
                errors.append("KPI requires exactly 1 measure")
            elif measure_types[0] not in QUANTITATIVE_TYPES:
                errors.append("KPI measure must be quantitative")

        # 4. Measure alias uniqueness
        aliases = [m.alias for m in config.measures if m.alias]
        if len(aliases) != len(set(aliases)):
            errors.append("Measure aliases must be unique")

    return errors