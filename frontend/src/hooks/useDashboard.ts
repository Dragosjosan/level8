import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { computeCurves, getCurves } from '../api/curves'
import { getSettings } from '../api/settings'
import { toComputationInput } from '../lib/curveData'
import { getErrorMessage } from '../lib/errors'
import type { ComputedCurve, Curve, CurveComputation, CurveInput, Settings } from '../types'

export type DashboardStatus = 'loading' | 'ready' | 'error'

interface UseDashboardOptions {
  onSettingsLoaded: (settings: Settings) => void
}

function mapComputations(
  curves: Curve[],
  computations: CurveComputation[],
): Map<string, CurveComputation> {
  const result = new Map(computations.map((computation) => [computation.curveId, computation]))

  for (const curve of curves) {
    if (!result.has(curve.id)) {
      throw new Error(`The API did not return a calculation for ${curve.name}.`)
    }
  }

  return result
}

async function calculateCurves(curves: Curve[]): Promise<Map<string, CurveComputation>> {
  if (curves.length === 0) {
    return new Map()
  }

  const computations = await computeCurves(curves.map(toComputationInput))
  return mapComputations(curves, computations)
}

export function useDashboard({ onSettingsLoaded }: UseDashboardOptions) {
  const [curves, setCurves] = useState<Curve[]>([])
  const [computations, setComputations] = useState<Map<string, CurveComputation>>(new Map())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [status, setStatus] = useState<DashboardStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [isModified, setIsModified] = useState(false)
  const requestId = useRef(0)

  const loadDefaults = useCallback(async () => {
    const currentRequest = ++requestId.current
    setStatus('loading')
    setError(null)

    try {
      const [canonicalCurves, settings] = await Promise.all([getCurves(), getSettings()])
      const canonicalComputations = await calculateCurves(canonicalCurves)

      if (currentRequest !== requestId.current) {
        return
      }

      setCurves(canonicalCurves)
      setComputations(canonicalComputations)
      setActiveId(
        canonicalCurves.some((curve) => curve.id === settings.activeId)
          ? settings.activeId
          : (canonicalCurves[0]?.id ?? null),
      )
      setIsModified(false)
      setStatus('ready')
      onSettingsLoaded(settings)
    } catch (loadError) {
      if (currentRequest !== requestId.current) {
        return
      }

      setError(getErrorMessage(loadError, 'The dashboard could not be loaded.'))
      setStatus('error')
    }
  }, [onSettingsLoaded])

  useEffect(() => {
    void loadDefaults()
  }, [loadDefaults])

  const computedCurves = useMemo<ComputedCurve[]>(
    () =>
      curves.flatMap((curve) => {
        const data = computations.get(curve.id)
        return data ? [{ ...curve, data }] : []
      }),
    [computations, curves],
  )

  const activeCurve =
    computedCurves.find((curve) => curve.id === activeId) ?? computedCurves[0] ?? null

  async function saveCurve(input: CurveInput, curveId: string | null): Promise<string> {
    const existingCurve = curves.find((curve) => curve.id === curveId)
    const id = existingCurve?.id ?? `medicine-${crypto.randomUUID()}`
    const nextCurve: Curve = {
      ...input,
      id,
      sortOrder:
        existingCurve?.sortOrder ?? Math.max(-1, ...curves.map((curve) => curve.sortOrder)) + 1,
    }
    const nextCurves = existingCurve
      ? curves.map((curve) => (curve.id === existingCurve.id ? nextCurve : curve))
      : [...curves, nextCurve]
    const nextComputations = await calculateCurves(nextCurves)

    setCurves(nextCurves)
    setComputations(nextComputations)
    setActiveId(id)
    setIsModified(true)

    return id
  }

  function deleteCurve(curveId: string) {
    const remainingCurves = curves.filter((curve) => curve.id !== curveId)

    setCurves(remainingCurves)
    setComputations((current) => {
      const next = new Map(current)
      next.delete(curveId)
      return next
    })
    setActiveId((current) => (current === curveId ? (remainingCurves[0]?.id ?? null) : current))
    setIsModified(true)
  }

  function toggleCurveVisibility(curveId: string) {
    setCurves((current) =>
      current.map((curve) =>
        curve.id === curveId ? { ...curve, visible: !curve.visible } : curve,
      ),
    )
    setIsModified(true)
  }

  return {
    activeCurve,
    activeId,
    computedCurves,
    error,
    isModified,
    status,
    deleteCurve,
    loadDefaults,
    saveCurve,
    setActiveId,
    toggleCurveVisibility,
  }
}
