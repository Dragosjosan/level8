import { requireUtcDateTime, toUtcDateTime } from '../lib/dateTime'
import type {
  PlannerCandidateResponseDto,
  PlannerRequestDto,
  PlannerResultResponseDto,
} from '../dto/planner'
import type { PlannerCandidate, PlannerRequest, PlannerResult } from '../types'
import { requestJson } from './client'

function parseCandidate(candidate: PlannerCandidateResponseDto, field: string): PlannerCandidate {
  return {
    ...candidate,
    refills: candidate.refills.map((refill, index) => ({
      ...refill,
      startsAt: requireUtcDateTime(refill.startsAt, `${field}.refills[${index}].startsAt`),
    })),
  }
}

export async function computePlanner(
  input: PlannerRequest,
  signal?: AbortSignal,
): Promise<PlannerResult> {
  const body: PlannerRequestDto = {
    ...input,
    windowStart: toUtcDateTime(input.windowStart),
    windowEnd: toUtcDateTime(input.windowEnd),
    infusionSlots: input.infusionSlots.map(toUtcDateTime),
  }

  const result = await requestJson<PlannerResultResponseDto>('/api/compute/planner', {
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
