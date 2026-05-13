# generate_schema.py
import json
from app.schemas.dashboard_schemas import DashboardConfig

# Generate JSON schema (Pydantic v2)
schema = DashboardConfig.model_json_schema()

# Save to the desired location
output_path = "app/schemas/config_schema.json"
with open(output_path, "w") as f:
    json.dump(schema, f, indent=2)

print(f"✅ Schema successfully written to {output_path}")