export type Theme = 'light' | 'dark'
export type Accent = 'teal' | 'indigo' | 'green' | 'amber' | 'slate'
export type CurveStyle = 'line' | 'area'
export type Density = 'spacious' | 'compact'
export type Skin = 'clinical' | 'document'

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
  decayConstant?: number
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
  decayConstant: number
  maximumIU: number
  doseSizes: number[]
  referenceDose: number
  referencePeak: number
  windowStart: Date
  windowEnd: Date
  infusionSlots: Date[]
  referenceLevel: number
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
  meanLevel: number
  lowestLevel: number
  peakLevel: number
  timeBelowReference: number
  meanPer1000IU: number
  meetsReference: boolean
  hours: number[]
  levels: number[]
  refillHours: number[]
}

export interface ParetoResult {
  windowStart: Date
  windowEnd: Date
  windowHours: number
  recommendations: ParetoCandidate[]
  front: ParetoCandidate[]
}

export interface WeeklyInfusion {
  startsAt: Date
}
