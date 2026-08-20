import { requireUtcDateTime, toUtcDateTime } from '../lib/dateTime'
import type {
  ParetoCandidateResponseDto,
  ParetoRequestDto,
  ParetoResultResponseDto,
} from '../dto/pareto'
import type { ParetoCandidate, ParetoRequest, ParetoResult } from '../types'
import { requestJson } from './client'

function parseCandidate(candidate: ParetoCandidateResponseDto, field: string): ParetoCandidate {
  return {
    ...candidate,
    refills: candidate.refills.map((refill, index) => ({
      ...refill,
      startsAt: requireUtcDateTime(refill.startsAt, `${field}.refills[${index}].startsAt`),
    })),
  }
}

export async function computePareto(
  input: ParetoRequest,
  signal?: AbortSignal,
): Promise<ParetoResult> {
  const body: ParetoRequestDto = {
    ...input,
    windowStart: toUtcDateTime(input.windowStart),
    windowEnd: toUtcDateTime(input.windowEnd),
    infusionSlots: input.infusionSlots.map(toUtcDateTime),
  }

  const result = await requestJson<ParetoResultResponseDto>('/api/compute/pareto', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  })

  return {
    ...result,
    windowStart: requireUtcDateTime(result.windowStart, 'windowStart'),
    windowEnd: requireUtcDateTime(result.windowEnd, 'windowEnd'),
    recommendations: result.recommendations.map((candidate, index) =>
      parseCandidate(candidate, `recommendations[${index}]`),
    ),
    front: result.front.map((candidate, index) => parseCandidate(candidate, `front[${index}]`)),
  }
}
