from datetime import UTC

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import SeedCurveConfig, SeedInfusionConfig
from app.db.models import AppSettingRecord, CurveRecord, utc_now


def _to_utc_text(curve_infusion: SeedInfusionConfig) -> str:
    starts_at = curve_infusion.starts_at
    return (
        starts_at.astimezone(UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def seed_database(
    session: Session,
    seed_settings: dict[str, str],
    seed_curves: tuple[SeedCurveConfig, ...],
) -> None:
    for key, value in seed_settings.items():
        if session.get(AppSettingRecord, key) is None:
            session.add(AppSettingRecord(key=key, value=value))

    has_curves = session.scalar(select(CurveRecord.id).limit(1)) is not None
    if has_curves:
        return

    for curve in seed_curves:
        timestamp = utc_now()
        session.add(
            CurveRecord(
                id=curve.id,
                name=curve.name,
                peak_level=curve.peak_level,
                time_elapsed=curve.time_elapsed,
                measured_level=curve.measured_level,
                weekly_infusions=[
                    {"starts_at": _to_utc_text(infusion)}
                    for infusion in curve.weekly_infusions
                ],
                color=curve.color,
                visible=curve.visible,
                is_constant=curve.is_constant,
                sort_order=curve.sort_order,
                created_at=timestamp,
                updated_at=timestamp,
            )
        )
