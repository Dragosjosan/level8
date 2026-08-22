from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from itertools import product
from math import exp, log

from app.services.decay_engine import periodic_level_at, sample_hours

SECONDS_IN_HOUR = 3600.0
FLOAT_TOLERANCE = 1e-9


@dataclass(frozen=True)
class ParetoParameters:
    decay_constant: float
    maximum_iu: int
    dose_sizes: tuple[int, ...]
    reference_dose: float
    reference_peak: float
    window_start: datetime
    window_end: datetime
    infusion_slots: tuple[datetime, ...]
    reference_level: float
    sample_interval_hours: float = 0.2


@dataclass(frozen=True)
class ParetoRefill:
    starts_at: datetime
    iu: int
    peak: float


@dataclass(frozen=True)
class ParetoCandidate:
    id: str
    doses: list[int]
    refills: list[ParetoRefill]
    injections: int
    total_iu: int
    mean_level: float
    lowest_level: float
    peak_level: float
    time_below_reference: float
    mean_per_1000_iu: float
    meets_reference: bool
    hours: list[float] = field(default_factory=list)
    levels: list[float] = field(default_factory=list)
    refill_hours: list[float] = field(default_factory=list)


@dataclass(frozen=True)
class ParetoResult:
    window_start: datetime
    window_end: datetime
    window_hours: float
    recommendations: list[ParetoCandidate]
    front: list[ParetoCandidate]


def _hours_between(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds() / SECONDS_IN_HOUR


def _segment_metrics(
    start_level: float,
    duration: float,
    decay_constant: float,
    reference_level: float,
) -> tuple[float, float, float]:
    end_level = start_level * exp(decay_constant * duration)
    auc = start_level * (exp(decay_constant * duration) - 1.0) / decay_constant

    if reference_level <= 0:
        time_below = 0.0
    elif start_level <= reference_level:
        time_below = duration
    elif end_level >= reference_level:
        time_below = 0.0
    else:
        crossing = log(reference_level / start_level) / decay_constant
        time_below = max(0.0, duration - crossing)

    return end_level, auc, time_below


def _evaluate(
    doses: tuple[int, ...],
    parameters: ParetoParameters,
) -> ParetoCandidate:
    peak_per_iu = parameters.reference_peak / parameters.reference_dose
    window_start = parameters.window_start.astimezone(UTC)
    window_end = parameters.window_end.astimezone(UTC)
    slots = tuple(slot.astimezone(UTC) for slot in parameters.infusion_slots)
    refill_data = [
        (_hours_between(window_start, slot), dose * peak_per_iu)
        for slot, dose in zip(slots, doses, strict=True)
        if dose > 0
    ]
    window_hours = _hours_between(window_start, window_end)
    level = periodic_level_at(
        0.0,
        [refill_hour for refill_hour, _ in refill_data],
        [peak for _, peak in refill_data],
        parameters.decay_constant,
    )
    lowest_level = level
    peak_level = level
    auc = 0.0
    time_below_reference = 0.0
    cursor = 0.0

    for refill_hour, refill_peak in refill_data:
        if refill_hour <= 0:
            continue
        duration = refill_hour - cursor
        level, segment_auc, segment_time_below = _segment_metrics(
            level,
            duration,
            parameters.decay_constant,
            parameters.reference_level,
        )
        auc += segment_auc
        time_below_reference += segment_time_below
        lowest_level = min(lowest_level, level)
        level += refill_peak
        peak_level = max(peak_level, level)
        cursor = refill_hour

    duration = window_hours - cursor
    level, segment_auc, segment_time_below = _segment_metrics(
        level,
        duration,
        parameters.decay_constant,
        parameters.reference_level,
    )
    auc += segment_auc
    time_below_reference += segment_time_below
    lowest_level = min(lowest_level, level)
    mean_level = auc / window_hours
    total_iu = sum(doses)
    refills = [
        ParetoRefill(starts_at=slot, iu=dose, peak=dose * peak_per_iu)
        for slot, dose in zip(slots, doses, strict=True)
        if dose > 0
    ]

    return ParetoCandidate(
        id="schedule-" + "-".join(str(dose) for dose in doses),
        doses=list(doses),
        refills=refills,
        injections=len(refills),
        total_iu=total_iu,
        mean_level=mean_level,
        lowest_level=lowest_level,
        peak_level=peak_level,
        time_below_reference=time_below_reference,
        mean_per_1000_iu=mean_level * 1000.0 / total_iu,
        meets_reference=lowest_level + FLOAT_TOLERANCE >= parameters.reference_level,
    )


def _is_better_recommendation(
    candidate: ParetoCandidate,
    current: ParetoCandidate,
) -> bool:
    if candidate.mean_level > current.mean_level + FLOAT_TOLERANCE:
        return True
    if current.mean_level > candidate.mean_level + FLOAT_TOLERANCE:
        return False
    if candidate.lowest_level > current.lowest_level + FLOAT_TOLERANCE:
        return True
    if current.lowest_level > candidate.lowest_level + FLOAT_TOLERANCE:
        return False
    if candidate.total_iu != current.total_iu:
        return candidate.total_iu < current.total_iu
    return candidate.id < current.id


def _dominates(left: ParetoCandidate, right: ParetoCandidate) -> bool:
    no_more_injections = left.injections <= right.injections
    no_lower_mean = left.mean_level + FLOAT_TOLERANCE >= right.mean_level
    strictly_better = (
        left.injections < right.injections
        or left.mean_level > right.mean_level + FLOAT_TOLERANCE
    )
    return no_more_injections and no_lower_mean and strictly_better


def _with_level_series(
    candidate: ParetoCandidate,
    parameters: ParetoParameters,
) -> ParetoCandidate:
    refill_hours = [
        _hours_between(parameters.window_start, refill.starts_at)
        for refill in candidate.refills
    ]
    hours = sample_hours(
        parameters.sample_interval_hours,
        refill_hours,
        _hours_between(parameters.window_start, parameters.window_end),
    )
    refill_peaks = [refill.peak for refill in candidate.refills]

    return replace(
        candidate,
        hours=hours,
        levels=[
            periodic_level_at(
                hour,
                refill_hours,
                refill_peaks,
                parameters.decay_constant,
            )
            for hour in hours
        ],
        refill_hours=refill_hours,
    )


def optimize_schedules(parameters: ParetoParameters) -> ParetoResult:
    recommendations_by_shots: dict[int, ParetoCandidate] = {}
    options = (0, *parameters.dose_sizes)

    for doses in product(options, repeat=len(parameters.infusion_slots)):
        total_iu = sum(doses)
        if total_iu <= 0 or total_iu > parameters.maximum_iu:
            continue

        candidate = _evaluate(doses, parameters)
        current = recommendations_by_shots.get(candidate.injections)
        if current is None or _is_better_recommendation(candidate, current):
            recommendations_by_shots[candidate.injections] = candidate

    recommendations_without_series = [
        recommendations_by_shots[shots] for shots in sorted(recommendations_by_shots)
    ]
    front_ids = {
        candidate.id
        for candidate in recommendations_without_series
        if not any(
            _dominates(other, candidate)
            for other in recommendations_without_series
            if other is not candidate
        )
    }
    recommendations = [
        _with_level_series(candidate, parameters)
        for candidate in recommendations_without_series
    ]
    front = [
        candidate
        for candidate in recommendations
        if candidate.id in front_ids
    ]

    return ParetoResult(
        window_start=parameters.window_start.astimezone(UTC),
        window_end=parameters.window_end.astimezone(UTC),
        window_hours=_hours_between(parameters.window_start, parameters.window_end),
        recommendations=recommendations,
        front=front,
    )
