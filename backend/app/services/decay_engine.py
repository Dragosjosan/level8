from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from math import exp, isfinite, log


HOURS_IN_WEEK = 168.0
SECONDS_IN_HOUR = 3600.0


@dataclass(frozen=True)
class CurveParameters:
    curve_id: str
    peak_level: float
    measured_level: float
    time_elapsed: float
    infusion_anchors: tuple[datetime, ...]
    decay_constant: float | None
    constant: bool


@dataclass(frozen=True)
class CurveResult:
    window_start: datetime
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


def _utc_week_start(now: datetime) -> datetime:
    normalized = now.astimezone(UTC)
    return (normalized - timedelta(days=normalized.weekday())).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


def sample_hours(
    interval: float,
    refill_hours: list[float],
    duration_hours: float = HOURS_IN_WEEK,
) -> list[float]:
    sample_count = int(duration_hours / interval)
    hours = {round(index * interval, 10) for index in range(sample_count + 1)}
    hours.add(duration_hours)
    hours.update(refill_hours)
    return sorted(hour for hour in hours if 0 <= hour <= duration_hours)


def _signed_decay_rate(parameters: CurveParameters) -> float:
    if parameters.constant:
        return 0.0
    rate = parameters.decay_constant
    if rate is None:
        if parameters.measured_level >= parameters.peak_level:
            raise ValueError("measuredLevel must be lower than peakLevel")
        rate = (
            log(parameters.measured_level / parameters.peak_level)
            / parameters.time_elapsed
        )
    if not isfinite(rate) or rate >= 0:
        raise ValueError("decayConstant must be a finite negative number")
    return rate


def periodic_level_at(
    hour: float,
    refill_hours: list[float],
    refill_peaks: list[float],
    decay_constant: float,
) -> float:
    cycle_multiplier = 1.0 / (1.0 - exp(decay_constant * HOURS_IN_WEEK))
    return sum(
        peak
        * exp(decay_constant * ((hour - refill_hour) % HOURS_IN_WEEK))
        * cycle_multiplier
        for refill_hour, peak in zip(refill_hours, refill_peaks, strict=True)
    )


def compute_curve(
    parameters: CurveParameters,
    sample_interval_hours: float,
    now: datetime,
) -> CurveResult:
    window_start = _utc_week_start(now)
    refill_hours = sorted(
        ((anchor.astimezone(UTC) - window_start).total_seconds() / SECONDS_IN_HOUR)
        % HOURS_IN_WEEK
        for anchor in parameters.infusion_anchors
    )
    hours = sample_hours(sample_interval_hours, refill_hours)
    decay_rate = _signed_decay_rate(parameters)

    if parameters.constant:
        levels = [parameters.peak_level for _ in hours]
        halving_time = None
    else:
        refill_peaks = [parameters.peak_level for _ in refill_hours]
        levels = [
            periodic_level_at(hour, refill_hours, refill_peaks, decay_rate)
            for hour in hours
        ]
        halving_time = abs(log(2.0) / decay_rate)

    auc = sum(
        (levels[index] + levels[index + 1]) * (hours[index + 1] - hours[index]) / 2.0
        for index in range(len(hours) - 1)
    )
    return CurveResult(
        window_start=window_start,
        curve_id=parameters.curve_id,
        hours=hours,
        levels=levels,
        decay_constant=decay_rate,
        halving_time=halving_time,
        refill_hours=refill_hours,
        peak=max(levels),
        trough=min(levels),
        auc=auc,
        mean_level=auc / HOURS_IN_WEEK,
        constant=parameters.constant,
    )
