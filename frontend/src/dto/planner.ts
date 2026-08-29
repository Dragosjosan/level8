import type { PlannerCandidate, PlannerRefill, PlannerRequest, PlannerResult } from '../types'

export type PlannerRequestDto = Omit<
  PlannerRequest,
  'planningStart' | 'windowStart' | 'windowEnd' | 'infusionSlots'
> & {
  planningStart: string
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
  'planningStart' | 'windowStart' | 'windowEnd' | 'recommendations' | 'front'
> & {
  planningStart: string
  windowStart: string
  windowEnd: string
  recommendations: PlannerCandidateResponseDto[]
  front: PlannerCandidateResponseDto[]
}
