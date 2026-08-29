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

export interface PlannerRequest {
  decayConstant: number
  totalIU: number
  packageSizes: number[]
  referenceDose: number
  referencePeak: number
  windowStart: Date
  windowEnd: Date
  infusionSlots: Date[]
  referenceLevel: number
}

export interface PlannerRefill {
  startsAt: Date
  iu: number
  peak: number
}

export interface PlannerCandidate {
  id: string
  doses: number[]
  refills: PlannerRefill[]
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

export interface PlannerResult {
  windowStart: Date
  windowEnd: Date
  windowHours: number
  recommendations: PlannerCandidate[]
  front: PlannerCandidate[]
}

export interface WeeklyInfusion {
  startsAt: Date
}
