import pandas as pd
from pathlib import Path
from sqlalchemy.orm import Session
from app.models.dataset import Dataset, SourceType
from app.models.mysql_connection import MySQLConnection
from app.services.mysql_connection_service import MySQLConnectionService
from app.services.pipeline.utils import dataframe_to_json_safe, sanitize_records

class DatasetLoader:

    @staticmethod
    def load_dataframe(dataset: Dataset, db: Session) -> pd.DataFrame:
        """Return a full pandas DataFrame for any dataset type."""
        if dataset.source_type == SourceType.mysql:
            if not dataset.connection_id or not dataset.source_table:
                raise ValueError("MySQL dataset missing connection_id or source_table")
            connection = db.query(MySQLConnection).filter(
                MySQLConnection.id == dataset.connection_id
            ).first()
            if not connection:
                raise ValueError("MySQL connection not found")
            engine = MySQLConnectionService._build_engine(connection)
            return pd.read_sql_table(dataset.source_table, engine)

        # File‑based
        file_path = Path(dataset.source_path)
        if not file_path.exists():
            raise FileNotFoundError(f"Source file missing: {file_path}")
        if dataset.source_type == SourceType.csv:
            try:
                return pd.read_csv(file_path)
            except UnicodeDecodeError:
                return pd.read_csv(file_path, encoding="latin-1")
        elif dataset.source_type == SourceType.excel:
            return pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported source type: {dataset.source_type}")

    @staticmethod
    def load_preview(dataset: Dataset, db: Session, rows: int = 50) -> list:
        """Return a JSON‑safe preview (list of dicts) for the dataset."""
        df = DatasetLoader.load_dataframe(dataset, db)
        preview_df = df.head(rows)
        safe = dataframe_to_json_safe(preview_df)
        safe = sanitize_records(safe)
        return safe