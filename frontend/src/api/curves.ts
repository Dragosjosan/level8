import { requireUtcDateTime, toUtcDateTime } from '../lib/dateTime'
import type {
  CurveComputationRequestDto,
  CurveComputationResponseDto,
  CurveResponseDto,
} from '../dto/curves'
import type { Curve, CurveComputation, CurveComputationInput } from '../types'
import { requestJson } from './client'

export async function getCurves(): Promise<Curve[]> {
  const curves = await requestJson<CurveResponseDto[]>('/api/curves')

  return curves.map((curve) => ({
    ...curve,
    weeklyInfusions: curve.weeklyInfusions.map((infusion) => ({
      startsAt: requireUtcDateTime(infusion.startsAt, 'weeklyInfusions.startsAt'),
    })),
  }))
}

export async function computeCurves(inputs: CurveComputationInput[]): Promise<CurveComputation[]> {
  const body: CurveComputationRequestDto[] = inputs.map((input) => ({
    ...input,
    weeklyInfusions: input.weeklyInfusions.map((infusion) => ({
      startsAt: toUtcDateTime(infusion.startsAt),
    })),
  }))

  const computations = await requestJson<CurveComputationResponseDto[]>('/api/compute/curves', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return computations.map((computation) => ({
    ...computation,
    windowStart: requireUtcDateTime(computation.windowStart, 'windowStart'),
  }))
}
