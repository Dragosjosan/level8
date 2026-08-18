from fastapi import APIRouter

from app.api.dependencies import DatabaseSession
from app.db.repositories import get_settings
from app.dto.settings import SettingsResponseDto


router = APIRouter(tags=["settings"])


@router.get("/settings", response_model=SettingsResponseDto)
def get_application_settings(session: DatabaseSession) -> SettingsResponseDto:
    return SettingsResponseDto.model_validate(get_settings(session))
