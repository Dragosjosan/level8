from datetime import UTC, datetime, timedelta

from pydantic import (
    AwareDatetime,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)

from app.dto.curves import CurveDto


MAX_SCHEDULE_CANDIDATES = 100_000


class ParetoRequestDto(CurveDto):
    decay_constant: float = Field(lt=0, allow_inf_nan=False)
    maximum_iu: int = Field(
        gt=0,
        le=100_000,
        validation_alias="maximumIU",
        serialization_alias="maximumIU",
    )
    dose_sizes: list[int] = Field(min_length=1, max_length=8)
    reference_dose: float = Field(gt=0, allow_inf_nan=False)
    reference_peak: float = Field(gt=0, allow_inf_nan=False)
    window_start: AwareDatetime
    window_end: AwareDatetime
    infusion_slots: list[AwareDatetime] = Field(min_length=1, max_length=7)
    reference_level: float = Field(ge=0, le=1000, allow_inf_nan=False)

    @field_validator("dose_sizes")
    @classmethod
    def validate_dose_sizes(cls, values: list[int]) -> list[int]:
        if any(value <= 0 or value > 100_000 for value in values):
            raise ValueError("doseSizes must contain positive values no greater than 100000")
        if len(values) != len(set(values)):
            raise ValueError("doseSizes must not contain duplicates")
        return sorted(values)

    @model_validator(mode="after")
    def validate_window_and_search_space(self) -> "ParetoRequestDto":
        window_start = self.window_start.astimezone(UTC)
        window_end = self.window_end.astimezone(UTC)
        duration = window_end - window_start

        if duration <= timedelta(0) or duration > timedelta(days=7):
            raise ValueError("windowEnd must be after windowStart and at most 7 days later")

        normalized_slots = [slot.astimezone(UTC) for slot in self.infusion_slots]
        if len(normalized_slots) != len(set(normalized_slots)):
            raise ValueError("infusionSlots must not contain duplicates")
        if any(slot < window_start or slot >= window_end for slot in normalized_slots):
            raise ValueError("each infusion slot must fall inside the selected window")

        candidate_count = (len(self.dose_sizes) + 1) ** len(normalized_slots) - 1
        if candidate_count > MAX_SCHEDULE_CANDIDATES:
            raise ValueError(
                "schedule search space is too large; "
                f"maximum is {MAX_SCHEDULE_CANDIDATES} candidates"
            )

        self.window_start = window_start
        self.window_end = window_end
        self.infusion_slots = sorted(normalized_slots)
        return self


class ParetoRefillDto(CurveDto):
    starts_at: AwareDatetime
    iu: int
    peak: float

    @field_serializer("starts_at", when_used="json")
    def serialize_starts_at(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat(timespec="milliseconds").replace(
            "+00:00", "Z"
        )


class ParetoCandidateDto(CurveDto):
    id: str
    doses: list[int]
    refills: list[ParetoRefillDto]
    injections: int
    total_iu: int = Field(serialization_alias="totalIU")
    mean_level: float
    lowest_level: float
    peak_level: float
    time_below_reference: float
    mean_per_1000_iu: float = Field(serialization_alias="meanPer1000IU")
    meets_reference: bool
    hours: list[float]
    levels: list[float]
    refill_hours: list[float]


class ParetoResultResponseDto(CurveDto):
    window_start: AwareDatetime
    window_end: AwareDatetime
    window_hours: float
    recommendations: list[ParetoCandidateDto]
    front: list[ParetoCandidateDto]

    @field_serializer("window_start", "window_end", when_used="json")
    def serialize_datetime(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat(timespec="milliseconds").replace(
            "+00:00", "Z"
        )
