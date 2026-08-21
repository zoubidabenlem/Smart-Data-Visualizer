from app.schemas.dashboard_schemas import WidgetConfig, ColumnRef, MeasureSpec, OrderByClause

class ChartRuleValidator:
    def validate(self, config: WidgetConfig) -> None:
         # 1. Basic rule: at least one measure or dimension
        if not config.measures and not config.dimensions:
            raise ValueError("Widget must have at least one dimension or measure")

        # 2. Chart type specific rules
        ct = config.chart_type
        if ct in {"bar", "line", "area"}:
            if len(config.dimensions) < 1 or len(config.measures) < 1:
                raise ValueError(f"{ct} chart requires at least 1 dimension and 1 measure")
        elif ct == "pie":
            if len(config.dimensions) != 1 or len(config.measures) != 1:
                raise ValueError("Pie chart requires exactly 1 dimension and 1 measure")
        elif ct == "scatter":
            if len(config.measures) < 2:
                raise ValueError("Scatter chart requires at least 2 measures")
        elif ct == "heatmap":
            if len(config.dimensions) < 2 or len(config.measures) < 1:
                raise ValueError("Heatmap requires at least 2 dimensions and 1 measure")
        elif ct == "kpi":
            if len(config.measures) != 1:
                raise ValueError("KPI requires exactly 1 measure")

        # 3. Unique aliases for measures
        aliases = [m.alias for m in config.measures if m.alias]
        if len(aliases) != len(set(aliases)):
            raise ValueError("Measure aliases must be unique")