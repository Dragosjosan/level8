export type Theme = 'light'
export type Accent = 'teal'
export type CurveStyle = 'line' | 'area'
export type Density = 'spacious' | 'compact'
export type Skin = 'clinical' | 'document'
export type ParetoObjective = 'trough' | 'meanLevel'

export interface Curve {
  id: string
  name: string
  peakLevel: number
  timeElapsed: number
  measuredLevel: number
  weeklyInfusions: WeeklyInfusion[]
  color: string
  visible: boolean
  constant: boolean
  sortOrder: number
}

export type CurveInput = Omit<Curve, 'id' | 'sortOrder'> & {
  sortOrder?: number
}

export interface CurveComputationInput {
  id: string
  peakLevel: number
  measuredLevel: number
  timeElapsed: number
  weeklyInfusions: WeeklyInfusion[]
  decayConstant?: number
  constant: boolean
}

export interface CurveComputation {
  windowStart: Date
  curveId: string
  hours: number[]
  levels: number[]
  decayConstant: number
  halvingTime: number | null
  refillHours: number[]
  peak: number
  trough: number
  auc: number
  meanLevel: number
  constant: boolean
}

export interface ComputedCurve extends Curve {
  data: CurveComputation
}

export interface Settings {
  activeId: string | null
  theme: Theme
  accent: Accent
  curveStyle: CurveStyle
  density: Density
  skin: Skin
}

export interface ParetoRequest {
  firstInfusionAt: Date
  decayConstant: number
  budget: number
  doseSizes: number[]
  refDose: number
  refPeak: number
  threshold: number
  requireThreshold: boolean
  objective: ParetoObjective
}

export interface ParetoRefill {
  startsAt: Date
  iu: number
  peak: number
}

export interface ParetoCandidate {
  id: string
  doses: number[]
  refills: ParetoRefill[]
  injections: number
  totalIU: number
  trough: number
  peak: number
  auc: number
  meanLevel: number
  timeBelow: number
  feasible: boolean
  constraintViolations: string[]
}

export interface ParetoSeries {
  totalIU: number
  candidateIds: string[]
}

export interface ParetoResult {
  candidates: ParetoCandidate[]
  front: ParetoCandidate[]
  seriesByTotalIU: ParetoSeries[]
}

export interface WeeklyInfusion {
  startsAt: Date
}
