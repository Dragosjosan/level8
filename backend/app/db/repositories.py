from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AppSettingRecord, CurveRecord


def list_curves(session: Session) -> list[CurveRecord]:
    statement = select(CurveRecord).order_by(CurveRecord.sort_order, CurveRecord.id)
    return list(session.scalars(statement))


def get_settings(session: Session) -> dict[str, str]:
    statement = select(AppSettingRecord).order_by(AppSettingRecord.key)
    return {setting.key: setting.value for setting in session.scalars(statement)}
