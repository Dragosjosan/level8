from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
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
        weekly_infusions=(datetime(2026, 8, 19, 4, 30, tzinfo=UTC),),
        color="oklch(0.58 0.12 210)",
        visible=True,
        is_constant=False,
        sort_order=0,
    ),
)


def _to_utc_text(starts_at: datetime) -> str:
    return (
        starts_at.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


def seed_database(session: Session) -> None:
    for key, value in SEED_SETTINGS:
        if session.get(AppSettingRecord, key) is None:
            session.add(AppSettingRecord(key=key, value=value))

    has_curves = session.scalar(select(CurveRecord.id).limit(1)) is not None
    if has_curves:
        return

    for curve in SEED_CURVES:
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
