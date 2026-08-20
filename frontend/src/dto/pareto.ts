import type { ParetoCandidate, ParetoRefill, ParetoRequest, ParetoResult } from '../types'

export type ParetoRequestDto = Omit<
  ParetoRequest,
  'windowStart' | 'windowEnd' | 'infusionSlots'
> & {
  windowStart: string
  windowEnd: string
  infusionSlots: string[]
}

export type ParetoRefillResponseDto = Omit<ParetoRefill, 'startsAt'> & {
  startsAt: string
}

export type ParetoCandidateResponseDto = Omit<ParetoCandidate, 'refills'> & {
  refills: ParetoRefillResponseDto[]
}

export type ParetoResultResponseDto = Omit<
  ParetoResult,
  'windowStart' | 'windowEnd' | 'recommendations' | 'front'
> & {
  windowStart: string
  windowEnd: string
  recommendations: ParetoCandidateResponseDto[]
  front: ParetoCandidateResponseDto[]
}
