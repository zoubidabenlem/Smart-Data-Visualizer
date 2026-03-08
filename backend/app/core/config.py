from pathlib import Path
from pydantic_settings import BaseSettings


# Resolves to the .env file sitting next to this file's parent directories.
# Expected layout:  backend/.env   and   backend/app/core/config.py
_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    # Database — matches your .env variable names exactly
    db_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str
    mysql_password: str
    mysql_database: str
    mysql_root_password: str  # only needed by Docker / init scripts

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # File uploads
    max_upload_size_mb: int = 50
    upload_dir: str = "./uploads"

    # Cache
    cache_ttl_seconds: int = 300
    cache_max_size: int = 100

    # CORS
    cors_origin: str = "http://localhost:4200"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.db_host}:{self.mysql_port}/{self.mysql_database}"
        )

    class Config:
        env_file = str(_ENV_PATH)
        env_file_encoding = "utf-8"


settings = Settings() # type: ignore
