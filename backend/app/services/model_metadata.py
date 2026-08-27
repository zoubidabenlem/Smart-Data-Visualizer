# app/services/model_metadata.py
from typing import Dict, List
from sqlalchemy.orm import Session
from app.models.data_model import DataModel
from app.models.dataset import Dataset

def get_model_column_metadata(model: DataModel, db: Session) -> Dict[int, List[Dict[str, str]]]:
    """
    Returns dict mapping of dataset_id to list of column metadata dicts.
    Each column metadata dict contains {"name": str, "type": str}.
    """
    metadata = {}
    # Adjusted from model.model_datasets to model.datasets to match DataModel definition[cite: 3]
    for model_dataset in model.datasets:
        dataset = db.query(Dataset).filter(Dataset.id == model_dataset.dataset_id).first()
        if not dataset:
            continue
        # Determine which schema to use
        schema = dataset.refined_column_schema or dataset.column_schema
        if not schema:
            metadata[dataset.id] = []
            continue

        columns = []
        
        if isinstance(schema, dict):
            for col_name, col_info in schema.items():
                if isinstance(col_info, dict):
                    # Check both 'type' and 'dtype' keys
                    raw_type = col_info.get("type") or col_info.get("dtype", "string")
                else:
                    raw_type = str(col_info)
                # Normalize type to lowercase for validation matching
                columns.append({"name": col_name, "type": str(raw_type).lower()})
                
        elif isinstance(schema, list):
            for col in schema:
                if isinstance(col, dict) and "name" in col:
                    raw_type = col.get("type") or col.get("dtype", "string")
                    columns.append({"name": col["name"], "type": str(raw_type).lower()})
                    
        metadata[dataset.id] = columns
    return metadata