import type {
    ParetoCandidate,
    ParetoRefill,
    ParetoRequest,
    ParetoResult,
} from '../types'

export type ParetoRequestDto = Omit<
    ParetoRequest,
    'firstInfusionAt'
> & {
    firstInfusionAt: string
}

export type ParetoRefillResponseDto = Omit<
    ParetoRefill,
    'startsAt'
> & {
    startsAt: string
}

export type ParetoCandidateResponseDto = Omit<
    ParetoCandidate,
    'refills'
> & {
    refills: ParetoRefillResponseDto[]
}

export type ParetoResultResponseDto = Omit<
    ParetoResult,
    'candidates' | 'front'
> & {
    candidates: ParetoCandidateResponseDto[]
    front: ParetoCandidateResponseDto[]
}
