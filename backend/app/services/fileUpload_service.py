import uuid
import shutil
from pathlib import Path
from typing import Optional
import pandas as pd
from fastapi  import UploadFile, HTTPException, status
from app.core.config import settings

#allowed types
ALLOWED_TYPES={
    "text/csv":                                                      "csv",
    "application/vnd.ms-excel":                                      "excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
}
MAX_BYTES= settings.max_upload_size_mb*1024*1024

#Convert a Pandas numpy dtype string to a friendly frontend type
def normalize_dtype(dtype_str:str) -> str:
    s= str(dtype_str).lower()
    if "int" in s or "float" in s:
        return "number"
    if "datetime" in s:
        return "date"
    return "text"

# Validate the file type and size, then save it to disk.
   # Returns the path where it was saved.
def save_upload(file: UploadFile) -> Path:
    #check if file type is valid
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Only CSV and Excel (.xlsx) are accepted.",
        )
    #save  to a temp type to check for0 size
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(exist_ok=True)

     # Give the file a unique name to avoid collisions
    safe_name = f"{uuid.uuid4()}_{file.filename}"
    dest = upload_dir / safe_name
    total_bytes=0
    with dest.open("wb") as out:
        while chunk:=file.file.read(8192):
            total_bytes+= len(chunk)
            if total_bytes> MAX_BYTES:
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_431_REQUEST_HEADER_FIELDS_TOO_LARGE,
                    detail=f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB.",
                )
            out.write(chunk)
    return dest
#  Load the file with Pandas and extract: - row_count - col_count - column_schema: [{"name": "revenue", "dtype": "number"}, ...]
def extract_metadata(file_path: Path, content_type: str) -> dict:
    file_type = ALLOWED_TYPES[content_type]
    try:
        if file_type =="csv":
            try: 
                df = pd.read_csv(file_path, encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding="latin-1")
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
       file_path.unlink(missing_ok=True)
       raise HTTPException(
           status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
           detail=f"Error parsing file: {e}",
       )
    column_schema = [
        {"name": col, "dtype": normalize_dtype(str(df[col].dtype))} 
        for col in df.columns
    ]
    return{
        "row_count": df.shape[0],
        "col_count": df.shape[1],
        "column_schema": column_schema,
        "file_path": str(file_path)
    }