from datetime import UTC, datetime, timedelta

from pydantic import (
    AwareDatetime,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)

from app.dto.curves import MAXIMUM_DECAY_CONSTANT, CurveDto
from app.services.dose_packages import (
    composable_doses,
    count_exact_schedules,
)


MAX_SCHEDULE_CANDIDATES = 100_000


class PlannerRequestDto(CurveDto):
    decay_constant: float = Field(le=MAXIMUM_DECAY_CONSTANT, allow_inf_nan=False)
    total_iu: int = Field(
        gt=0,
        le=100_000,
        validation_alias="totalIU",
        serialization_alias="totalIU",
    )
    package_sizes: list[int] = Field(min_length=1, max_length=8)
    reference_dose: float = Field(gt=0, allow_inf_nan=False)
    reference_peak: float = Field(gt=0, allow_inf_nan=False)
    planning_start: AwareDatetime
    window_start: AwareDatetime
    window_end: AwareDatetime
    infusion_slots: list[AwareDatetime] = Field(min_length=1, max_length=7)
    reference_level: float = Field(ge=0, le=1000, allow_inf_nan=False)

    @field_validator("package_sizes")
    @classmethod
    def validate_package_sizes(cls, values: list[int]) -> list[int]:
        if any(value <= 0 or value > 100_000 for value in values):
            raise ValueError("packageSizes must contain positive values no greater than 100000")
        if len(values) != len(set(values)):
            raise ValueError("packageSizes must not contain duplicates")
        return sorted(values)

    @model_validator(mode="after")
    def validate_window_and_search_space(self) -> "PlannerRequestDto":
        planning_start = self.planning_start.astimezone(UTC)
        window_start = self.window_start.astimezone(UTC)
        window_end = self.window_end.astimezone(UTC)
        duration = window_end - window_start
        planning_end = planning_start + timedelta(days=7)

        if duration <= timedelta(0) or duration > timedelta(days=7):
            raise ValueError("windowEnd must be after windowStart and at most 7 days later")
        if window_start < planning_start or window_end > planning_end:
            raise ValueError("the evaluation window must fall inside the seven-day planning horizon")

        normalized_slots = [slot.astimezone(UTC) for slot in self.infusion_slots]
        if len(normalized_slots) != len(set(normalized_slots)):
            raise ValueError("infusionSlots must not contain duplicates")
        if any(slot < planning_start or slot >= planning_end for slot in normalized_slots):
            raise ValueError("each infusion slot must fall inside the seven-day planning horizon")

        doses = composable_doses(self.total_iu, tuple(self.package_sizes))
        if self.total_iu not in doses:
            raise ValueError("totalIU cannot be composed from the selected packageSizes")

        candidate_count = count_exact_schedules(
            self.total_iu,
            doses,
            len(normalized_slots),
            stop_after=MAX_SCHEDULE_CANDIDATES,
        )
        if candidate_count > MAX_SCHEDULE_CANDIDATES:
            raise ValueError(
                "schedule search space is too large; "
                f"maximum is {MAX_SCHEDULE_CANDIDATES} candidates"
            )

        self.planning_start = planning_start
        self.window_start = window_start
        self.window_end = window_end
        self.infusion_slots = sorted(normalized_slots)
        return self


class PlannerRefillDto(CurveDto):
    starts_at: AwareDatetime
    iu: int
    peak: float

    @field_serializer("starts_at", when_used="json")
    def serialize_starts_at(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat(timespec="milliseconds").replace(
            "+00:00", "Z"
        )


class PlannerCandidateDto(CurveDto):
    id: str
    doses: list[int]
    refills: list[PlannerRefillDto]
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


class PlannerResultResponseDto(CurveDto):
    planning_start: AwareDatetime
    window_start: AwareDatetime
    window_end: AwareDatetime
    window_hours: float
    recommendations: list[PlannerCandidateDto]
    front: list[PlannerCandidateDto]

    @field_serializer("planning_start", "window_start", "window_end", when_used="json")
    def serialize_datetime(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat(timespec="milliseconds").replace(
            "+00:00", "Z"
        )
