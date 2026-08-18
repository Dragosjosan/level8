from fastapi import APIRouter

from app.api.dependencies import DatabaseSession
from app.db.repositories import list_curves
from app.dto.curves import CurveResponseDto


router = APIRouter(tags=["curves"])


@router.get("/curves", response_model=list[CurveResponseDto])
def get_curves(session: DatabaseSession) -> list[CurveResponseDto]:
    return [CurveResponseDto.model_validate(curve) for curve in list_curves(session)]
