import type { Curve, CurveComputation, CurveComputationInput } from '../types'

export interface CurveResponseDto extends Omit<Curve, 'weeklyInfusions'> {
  weeklyInfusions: {
    startsAt: string
  }[]
}

export type CurveComputationRequestDto = Omit<CurveComputationInput, 'weeklyInfusions'> & {
  weeklyInfusions: {
    startsAt: string
  }[]
}

export type CurveComputationResponseDto = Omit<CurveComputation, 'windowStart'> & {
  windowStart: string
}
