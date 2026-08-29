import type { PlannerCandidate, PlannerRefill, PlannerRequest, PlannerResult } from '../types'

export type PlannerRequestDto = Omit<
  PlannerRequest,
  'windowStart' | 'windowEnd' | 'infusionSlots'
> & {
  windowStart: string
  windowEnd: string
  infusionSlots: string[]
}

export type PlannerRefillResponseDto = Omit<PlannerRefill, 'startsAt'> & {
  startsAt: string
}

export type PlannerCandidateResponseDto = Omit<PlannerCandidate, 'refills'> & {
  refills: PlannerRefillResponseDto[]
}

export type PlannerResultResponseDto = Omit<
  PlannerResult,
  'windowStart' | 'windowEnd' | 'recommendations' | 'front'
> & {
  windowStart: string
  windowEnd: string
  recommendations: PlannerCandidateResponseDto[]
  front: PlannerCandidateResponseDto[]
}
