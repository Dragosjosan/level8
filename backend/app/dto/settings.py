from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.dto.curves import to_camel_case


class SettingsResponseDto(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel_case, populate_by_name=True)

    active_id: str | None
    theme: Literal["light", "dark"]
    accent: Literal["teal", "indigo", "green", "amber", "slate"]
    curve_style: Literal["line", "area"]
    density: Literal["spacious", "compact"]
    skin: Literal["clinical", "document"]
