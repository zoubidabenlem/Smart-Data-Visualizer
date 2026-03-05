from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os
from typing import Union

class Settings(BaseSettings):
    mysql_port: int
    mysql_user: Union[str, None]
    mysql_password:Union[str, None]
    mysql_database: Union[str, None]
    jwt_secret: Union[str, None]
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    max_upload_size_mb: int = 50
    upload_dir: str = "./uploads"
    cache_ttl_seconds: int = 300
    cache_max_size: int = 100
    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
            f"@localhost:{self.mysql_port}/{self.mysql_database}"
        )

    class Config:
        env_file = ".env"
        load_dotenv()

settings = Settings(
    mysql_port=int(os.environ.get("MYSQL_PORT", "0")),
    mysql_user=os.environ.get("MYSQL_USER"),
    mysql_password=os.environ.get("MYSQL_PASSWORD"),
    mysql_database=os.environ.get("MYSQL_DATABASE"),
    jwt_secret=os.environ.get("JWT_SECRET")
)