import type { Curve, CurveComputation, CurveComputationInput } from '../types'
import { getFixedWeekHour } from './dateTime'

export interface CurrentCurvePoint {
  hour: number
  level: number
}

export function toComputationInput(curve: Curve): CurveComputationInput {
  return {
    id: curve.id,
    peakLevel: curve.peakLevel,
    measuredLevel: curve.measuredLevel,
    timeElapsed: curve.timeElapsed,
    weeklyInfusions: curve.weeklyInfusions,
    decayConstant: curve.decayConstant,
    constant: curve.constant,
  }
}

export function interpolateLevel(computation: CurveComputation, hour: number): number {
  const sampleCount = Math.min(computation.hours.length, computation.levels.length)

  if (sampleCount === 0) {
    return 0
  }

  if (hour <= computation.hours[0]) {
    return computation.levels[0] ?? 0
  }

  const lastIndex = sampleCount - 1

  if (hour >= (computation.hours[lastIndex] ?? 168)) {
    return computation.levels[lastIndex] ?? 0
  }

  let leftIndex = 0
  let rightIndex = lastIndex

  while (leftIndex + 1 < rightIndex) {
    const middleIndex = Math.floor((leftIndex + rightIndex) / 2)

    if ((computation.hours[middleIndex] ?? 0) <= hour) {
      leftIndex = middleIndex
    } else {
      rightIndex = middleIndex
    }
  }

  const leftHour = computation.hours[leftIndex] ?? hour
  const rightHour = computation.hours[rightIndex] ?? hour
  const leftLevel = computation.levels[leftIndex] ?? 0
  const rightLevel = computation.levels[rightIndex] ?? leftLevel
  const interval = rightHour - leftHour

  if (interval <= 0) {
    return rightLevel
  }

  const progress = (hour - leftHour) / interval
  return leftLevel + progress * (rightLevel - leftLevel)
}

export function getCurrentCurvePoint(
  computation: CurveComputation,
  currentTime: Date,
): CurrentCurvePoint {
  const hour = getFixedWeekHour(currentTime, computation.windowStart)

  return {
    hour,
    level: interpolateLevel(computation, hour),
  }
}

export function getHoursUntilNextInfusion(
  computation: CurveComputation,
  currentTime: Date,
): number | null {
  const refillHours = [...computation.refillHours].sort((left, right) => left - right)

  if (refillHours.length === 0) {
    return null
  }

  const currentHour = getFixedWeekHour(currentTime, computation.windowStart)
  const nextHour = refillHours.find((hour) => hour > currentHour)

  if (nextHour !== undefined) {
    return nextHour - currentHour
  }

  return (refillHours[0] ?? 0) + 168 - currentHour
}
