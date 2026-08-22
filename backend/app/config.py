from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, StringConstraints, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import make_url


BACKEND_ROOT = Path(__file__).resolve().parents[1]


NonEmptyString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_prefix="FACTOR8_",
        extra="ignore",
    )

    project_name: NonEmptyString
    api_prefix: NonEmptyString
    database_url: NonEmptyString
    cors_origins: tuple[NonEmptyString, ...]
    curve_sample_interval_hours: float = Field(gt=0, le=168)

    @field_validator("database_url", mode="after")
    @classmethod
    def resolve_database_url(cls, value: str) -> str:
        url = make_url(value)
        if url.get_backend_name() == "sqlite" and url.database not in (
            None,
            ":memory:",
        ):
            database_path = Path(url.database)
            if not database_path.is_absolute():
                url = url.set(database=str(BACKEND_ROOT / database_path))
        return url.render_as_string(hide_password=False)


@lru_cache
def get_config() -> AppConfig:
    return AppConfig()
