import uuid
import shutil
from pathlib import Path
from typing import Optional
import pandas as pd
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings

# Allowed MIME types
ALLOWED_TYPES = {
    "text/csv": "csv",
    "application/vnd.ms-excel": "excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
}
MAX_BYTES = settings.max_upload_size_mb * 1024 * 1024


def normalize_dtype(dtype_str: str) -> str:
    """Convert a Pandas numpy dtype string to a friendly frontend type."""
    s = str(dtype_str).lower()
    if "int" in s or "float" in s:
        return "number"
    if "datetime" in s:
        return "date"
    return "text"


def save_upload(file: UploadFile) -> Path:
    """
    Validate file type and size, then save to disk.
    Raises HTTPException if file is empty, too large, or unsupported.
    """
    # Check content type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Only CSV and Excel (.xlsx) are accepted.",
        )

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(exist_ok=True)

    safe_name = f"{uuid.uuid4()}_{file.filename}"
    dest = upload_dir / safe_name
    total_bytes = 0

    with dest.open("wb") as out:
        while chunk := file.file.read(8192):
            total_bytes += len(chunk)
            if total_bytes > MAX_BYTES:
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_431_REQUEST_HEADER_FIELDS_TOO_LARGE,
                    detail=f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB.",
                )
            out.write(chunk)

    # After writing, check if the file is completely empty
    if total_bytes == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    return dest


def extract_metadata(file_path: Path, content_type: str) -> dict:
    """
    Load the file with Pandas and extract metadata.
    Raises HTTPException if the file has no rows, no columns, or is unreadable.
    """
    file_type = ALLOWED_TYPES.get(content_type)
    if file_type is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported content type.",
        )

    try:
        if file_type == "csv":
            try:
                df = pd.read_csv(file_path, encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding="latin-1")
        else:  # excel
            df = pd.read_excel(file_path)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Error parsing file: {e}",
        )

    # Validation: file must contain at least one row (header-only files are rejected)
    if df.empty:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file contains no data rows. Please provide a file with at least one row of data.",
        )

    # Validation: file must have at least one column
    if len(df.columns) == 0:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file has no columns. A valid spreadsheet must have at least one column.",
        )

    # Build column schema
    column_schema = [
        {"name": col, "dtype": normalize_dtype(str(df[col].dtype))}
        for col in df.columns
    ]

    return {
        "row_count": df.shape[0],
        "col_count": df.shape[1],
        "column_schema": column_schema,
        "file_path": str(file_path),
    }