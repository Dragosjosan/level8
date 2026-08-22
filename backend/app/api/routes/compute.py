from datetime import UTC, datetime

from fastapi import APIRouter, Request

from app.config import AppConfig
from app.dto.curves import (
    CurveComputationRequestDto,
    CurveComputationResponseDto,
)
from app.dto.pareto import ParetoRequestDto, ParetoResultResponseDto
from app.services.decay_engine import CurveParameters, compute_curve
from app.services.pareto import ParetoParameters, optimize_schedules

router = APIRouter(prefix="/compute", tags=["compute"])


@router.post("/curves", response_model=list[CurveComputationResponseDto])
def compute_curves(
    curves: list[CurveComputationRequestDto],
    request: Request,
) -> list[CurveComputationResponseDto]:
    config: AppConfig = request.app.state.config
    now = datetime.now(UTC)
    return [
        CurveComputationResponseDto.model_validate(
            compute_curve(
                CurveParameters(
                    curve_id=curve.id,
                    peak_level=curve.peak_level,
                    measured_level=curve.measured_level,
                    time_elapsed=curve.time_elapsed,
                    infusion_anchors=tuple(
                        infusion.starts_at for infusion in curve.weekly_infusions
                    ),
                    decay_constant=curve.decay_constant,
                    constant=curve.constant,
                ),
                sample_interval_hours=config.curve_sample_interval_hours,
                now=now,
            )
        )
        for curve in curves
    ]


@router.post("/pareto", response_model=ParetoResultResponseDto)
def compute_pareto(
    pareto: ParetoRequestDto,
    request: Request,
) -> ParetoResultResponseDto:
    config: AppConfig = request.app.state.config
    result = optimize_schedules(
        ParetoParameters(
            decay_constant=pareto.decay_constant,
            maximum_iu=pareto.maximum_iu,
            dose_sizes=tuple(pareto.dose_sizes),
            reference_dose=pareto.reference_dose,
            reference_peak=pareto.reference_peak,
            window_start=pareto.window_start,
            window_end=pareto.window_end,
            infusion_slots=tuple(pareto.infusion_slots),
            reference_level=pareto.reference_level,
            sample_interval_hours=config.curve_sample_interval_hours,
        )
    )
    return ParetoResultResponseDto.model_validate(result)
