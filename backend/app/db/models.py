from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Float, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator


def utc_now() -> datetime:
    return datetime.now(UTC)


class UtcDateTime(TypeDecorator[datetime]):
    impl = String(24)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> str | None:
        del dialect
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("UTC datetime fields require a timezone-aware value")
        return (
            value.astimezone(UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )

    def process_result_value(self, value: str | None, dialect: Any) -> datetime | None:
        del dialect
        if value is None:
            return None
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


class Base(DeclarativeBase):
    pass


class CurveRecord(Base):
    __tablename__ = "curves"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    peak_level: Mapped[float] = mapped_column(Float, nullable=False)
    time_elapsed: Mapped[float] = mapped_column(Float, nullable=False)
    measured_level: Mapped[float] = mapped_column(Float, nullable=False)
    weekly_infusions: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_constant: Mapped[bool] = mapped_column(Boolean, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime(), nullable=False)


class AppSettingRecord(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)
