from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.db.models import AppSettingRecord, CurveRecord, utc_now


@dataclass(frozen=True, slots=True)
class _SeedCurve:
    id: str
    name: str
    peak_level: float
    time_elapsed: float
    measured_level: float
    weekly_infusions: tuple[datetime, ...]
    color: str
    visible: bool
    is_constant: bool
    sort_order: int


SEED_SETTINGS: tuple[tuple[str, str], ...] = (
    ("activeId", "altuvoct"),
    ("theme", "light"),
    ("accent", "teal"),
    ("curveStyle", "area"),
    ("density", "spacious"),
    ("skin", "clinical"),
)

SEED_CURVES: tuple[_SeedCurve, ...] = (
    _SeedCurve(
        id="altuvoct",
        name="Altuvoct",
        peak_level=100,
        time_elapsed=168,
        measured_level=7,
        weekly_infusions=(datetime(2026, 8, 19, 5, 30, tzinfo=UTC),),
        color="oklch(0.58 0.12 210)",
        visible=True,
        is_constant=False,
        sort_order=0,
    ),
)


def _to_utc_text(starts_at: datetime) -> str:
    return (
        starts_at.astimezone(UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def insert_missing_settings(session: Session):
    for key, value in SEED_SETTINGS:
        table_name = session.get(AppSettingRecord, key)
        if table_name is None:
            session.add(AppSettingRecord(key=key, value=value))


def read_database(session: Session) -> None:

    for curve in SEED_CURVES:
        db_curve = session.execute(
            select(CurveRecord).where(CurveRecord.id == curve.id)
        ).scalar_one()
        curve_data = {
            attr.key: getattr(db_curve, attr.key)
            for attr in inspect(db_curve).mapper.column_attrs
        }
        for key, value in curve_data.items():
            print(f"{key}: {value}")


def update_database(session: Session) -> None:
    insert_missing_settings(session=session)

    for curve in SEED_CURVES:
        db_curve = session.execute(
            select(CurveRecord).where(CurveRecord.id == curve.id)
        ).scalar_one()

        timestamp = utc_now()

        db_curve.name = curve.name
        db_curve.peak_level = curve.peak_level
        db_curve.time_elapsed = curve.time_elapsed
        db_curve.measured_level = curve.measured_level
        db_curve.weekly_infusions = [
            {"starts_at": _to_utc_text(starts_at=starts_at)}
            for starts_at in curve.weekly_infusions
        ]
        db_curve.color = curve.color
        db_curve.visible = curve.visible
        db_curve.is_constant = curve.is_constant
        db_curve.sort_order = curve.sort_order
        db_curve.updated_at = timestamp


def seed_database(session: Session) -> None:
    insert_missing_settings(session=session)

    for curve in SEED_CURVES:
        if session.get(CurveRecord, curve.id) is not None:
            continue

        timestamp = utc_now()
        session.add(
            CurveRecord(
                id=curve.id,
                name=curve.name,
                peak_level=curve.peak_level,
                time_elapsed=curve.time_elapsed,
                measured_level=curve.measured_level,
                weekly_infusions=[
                    {"starts_at": _to_utc_text(starts_at)}
                    for starts_at in curve.weekly_infusions
                ],
                color=curve.color,
                visible=curve.visible,
                is_constant=curve.is_constant,
                sort_order=curve.sort_order,
                created_at=timestamp,
                updated_at=timestamp,
            )
        )
