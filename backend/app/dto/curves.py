from datetime import UTC, datetime

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
)


def to_camel_case(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(word.capitalize() for word in rest)


class CurveDto(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel_case,
        from_attributes=True,
        populate_by_name=True,
    )


class WeeklyInfusionDto(CurveDto):
    starts_at: AwareDatetime

    @field_serializer("starts_at", when_used="json")
    def serialize_starts_at(self, value: datetime) -> str:
        return (
            value.astimezone(UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )


class CurveResponseDto(CurveDto):
    id: str
    name: str
    peak_level: float
    time_elapsed: float
    measured_level: float
    weekly_infusions: list[WeeklyInfusionDto]
    color: str
    visible: bool
    constant: bool = Field(validation_alias="is_constant")
    sort_order: int


class CurveComputationRequestDto(CurveDto):
    id: str
    peak_level: float = Field(gt=0, allow_inf_nan=False)
    measured_level: float = Field(gt=0, allow_inf_nan=False)
    time_elapsed: float = Field(gt=0, allow_inf_nan=False)
    weekly_infusions: list[WeeklyInfusionDto] = Field(min_length=1)
    decay_constant: float | None = Field(default=None, allow_inf_nan=False)
    constant: bool


class CurveComputationResponseDto(CurveDto):
    window_start: AwareDatetime
    curve_id: str
    hours: list[float]
    levels: list[float]
    decay_constant: float
    halving_time: float | None
    refill_hours: list[float]
    peak: float
    trough: float
    auc: float
    mean_level: float
    constant: bool

    @field_serializer("window_start", when_used="json")
    def serialize_window_start(self, value: datetime) -> str:
        return (
            value.astimezone(UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )
