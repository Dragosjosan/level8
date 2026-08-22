import { useEffect, useMemo, useState } from 'react'
import { computePareto } from '../api/pareto'
import { formatLocalWeeklyInfusion } from '../lib/dateTime'
import { getErrorMessage } from '../lib/errors'
import type { ComputedCurve, ParetoRequest, ParetoResult } from '../types'
import { FactorChart, type FactorChartCurve } from './FactorChart'
import { ParetoPlot } from './ParetoPlot'

interface ParetoSectionProps {
  activeCurve: ComputedCurve
}

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
] as const

const DOSE_OPTIONS = [250, 500, 1000] as const
const LOCAL_TIME_PATTERN = /^(\d{2}):(\d{2})$/

interface WindowDates {
  windowStart: Date
  windowEnd: Date
  infusionSlots: Date[]
}

function resolveWindowDates(
  startDay: number,
  endDay: number,
  infusionTime: string,
): WindowDates | null {
  const match = LOCAL_TIME_PATTERN.exec(infusionTime)
  const hours = match ? Number(match[1]) : -1
  const minutes = match ? Number(match[2]) : -1

  if (startDay < 1 || endDay > 7 || startDay > endDay || hours > 23 || minutes > 59) {
    return null
  }

  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  const windowStart = new Date(monday)
  windowStart.setDate(monday.getDate() + startDay - 1)

  const windowEnd = new Date(monday)
  windowEnd.setDate(monday.getDate() + endDay)

  const infusionSlots = Array.from({ length: endDay - startDay + 1 }, (_, index) => {
    const slot = new Date(monday)
    slot.setDate(monday.getDate() + startDay - 1 + index)
    slot.setHours(hours, minutes, 0, 0)
    return slot
  })

  if (
    infusionSlots.some(
      (slot) =>
        Number.isNaN(slot.getTime()) || slot.getHours() !== hours || slot.getMinutes() !== minutes,
    )
  ) {
    return null
  }

  return { windowStart, windowEnd, infusionSlots }
}

function positiveNumber(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function ParetoSection({ activeCurve }: ParetoSectionProps) {
  const [maximumIU, setMaximumIU] = useState('750')
  const [doseSizes, setDoseSizes] = useState<number[]>([...DOSE_OPTIONS])
  const [referenceDose, setReferenceDose] = useState('500')
  const [referencePeak, setReferencePeak] = useState(() => String(activeCurve.peakLevel))
  const [referenceLevel, setReferenceLevel] = useState('5')
  const [startDay, setStartDay] = useState(1)
  const [endDay, setEndDay] = useState(4)
  const [infusionTime, setInfusionTime] = useState('07:30')
  const [selectedShots, setSelectedShots] = useState(1)
  const [result, setResult] = useState<ParetoResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setReferencePeak(String(activeCurve.peakLevel))
    setResult(null)
  }, [activeCurve.id, activeCurve.peakLevel])

  const request = useMemo<ParetoRequest | null>(() => {
    const parsedMaximumIU = positiveInteger(maximumIU)
    const parsedReferenceDose = positiveNumber(referenceDose)
    const parsedReferencePeak = positiveNumber(referencePeak)
    const parsedReferenceLevel = Number(referenceLevel)
    const dates = resolveWindowDates(startDay, endDay, infusionTime)

    if (
      parsedMaximumIU === null ||
      parsedReferenceDose === null ||
      parsedReferencePeak === null ||
      !Number.isFinite(parsedReferenceLevel) ||
      parsedReferenceLevel < 0 ||
      doseSizes.length === 0 ||
      dates === null
    ) {
      return null
    }

    return {
      decayConstant: activeCurve.data.decayConstant,
      maximumIU: parsedMaximumIU,
      doseSizes,
      referenceDose: parsedReferenceDose,
      referencePeak: parsedReferencePeak,
      referenceLevel: parsedReferenceLevel,
      ...dates,
    }
  }, [
    activeCurve.data.decayConstant,
    doseSizes,
    endDay,
    infusionTime,
    maximumIU,
    referenceDose,
    referenceLevel,
    referencePeak,
    startDay,
  ])

  useEffect(() => {
    if (activeCurve.constant || request === null) {
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      void computePareto(request, controller.signal)
        .then((nextResult) => {
          setResult(nextResult)
          setSelectedShots((current) =>
            nextResult.recommendations.some((candidate) => candidate.injections === current)
              ? current
              : (nextResult.recommendations[0]?.injections ?? 1),
          )
        })
        .catch((requestError: unknown) => {
          if (!controller.signal.aborted) {
            setError(getErrorMessage(requestError, 'The coverage options could not be calculated.'))
            setResult(null)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        })
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [activeCurve.constant, request])

  function toggleDoseSize(dose: number) {
    setDoseSizes((current) =>
      current.includes(dose)
        ? current.filter((value) => value !== dose)
        : [...current, dose].sort((left, right) => left - right),
    )
  }

  const selected = result?.recommendations.find(
    (candidate) => candidate.injections === selectedShots,
  )
  const selectedCurve: FactorChartCurve | null =
    selected && result
      ? {
          id: selected.id,
          name: `${selected.injections}-shot option`,
          color: activeCurve.color,
          visible: true,
          data: {
            windowStart: result.windowStart,
            hours: selected.hours,
            levels: selected.levels,
            refillHours: selected.refillHours,
          },
        }
      : null
  const frontIds = new Set(result?.front.map((candidate) => candidate.id) ?? [])
  const windowLabel = `${WEEKDAYS[startDay - 1]?.label ?? 'Monday'}–${WEEKDAYS[endDay - 1]?.label ?? 'Thursday'}`

  return (
    <section className="coverage-planner" aria-labelledby="coverage-planner-title">
      <header className="coverage-planner-header">
        <h2 className="coverage-planner-title" id="coverage-planner-title">
          Infusions for high activities
        </h2>
        <p>Check different infusion scenarios to get the best average for an intense period (e.g. sports)</p>
      </header>

      <div className="coverage-planner-body">
        {activeCurve.constant ? (
          <p className="pareto-empty">
            {activeCurve.name} is modeled as a constant level, so an infusion schedule cannot be
            optimized.
          </p>
        ) : (
          <>
            <div className="pareto-group-label">Activity period</div>
            <div className="pareto-controls coverage-window-controls">
              <label className="field">
                <span className="field-label">First day</span>
                <select
                  className="input"
                  value={startDay}
                  onChange={(event) => setStartDay(Number(event.target.value))}
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Last day</span>
                <select
                  className="input"
                  value={endDay}
                  onChange={(event) => setEndDay(Number(event.target.value))}
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={day.value} disabled={day.value < startDay}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Infusion time</span>
                <input
                  className="input"
                  type="time"
                  value={infusionTime}
                  onChange={(event) => setInfusionTime(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Minimum factor level</span>
                <span className="input-affix">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="1"
                    value={referenceLevel}
                    onChange={(event) => setReferenceLevel(event.target.value)}
                  />
                  <span className="affix">%</span>
                </span>
              </label>
            </div>

            <div className="pareto-group-label">Dose limits</div>
            <div className="pareto-controls factor-controls">
              <label className="field">
                <span className="field-label">Maximum total for {windowLabel}</span>
                <span className="input-affix">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="250"
                    value={maximumIU}
                    onChange={(event) => setMaximumIU(event.target.value)}
                  />
                  <span className="affix">IU</span>
                </span>
              </label>
              <fieldset className="field dose-fieldset">
                <legend className="field-label">Dose sizes</legend>
                <div className="dose-toggles">
                  {DOSE_OPTIONS.map((dose) => (
                    <button
                      key={dose}
                      type="button"
                      className={`dose-chip ${doseSizes.includes(dose) ? 'on' : ''}`}
                      aria-pressed={doseSizes.includes(dose)}
                      onClick={() => toggleDoseSize(dose)}
                    >
                      {dose} IU
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="field reference-field">
                <span className="field-label">Dose calibration (dose → immediate rise)</span>
                <div className="ref-pair">
                  <span className="input-affix">
                    <input
                      className="input"
                      type="number"
                      min="1"
                      step="250"
                      value={referenceDose}
                      onChange={(event) => setReferenceDose(event.target.value)}
                    />
                    <span className="affix">IU</span>
                  </span>
                  <span className="ref-arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="input-affix">
                    <input
                      className="input"
                      type="number"
                      min="0.1"
                      step="1"
                      value={referencePeak}
                      onChange={(event) => setReferencePeak(event.target.value)}
                    />
                    <span className="affix">%</span>
                  </span>
                </div>
              </div>
            </div>

            {request === null ? (
              <p className="pareto-empty" role="alert">
                Enter a valid activity period, infusion time, dose limit, calibration, and at least
                one dose size.
              </p>
            ) : error ? (
              <p className="pareto-error" role="alert">
                {error}
              </p>
            ) : loading && result === null ? (
              <output className="pareto-empty">Comparing schedules…</output>
            ) : result && result.recommendations.length > 0 ? (
              <>
                <div className="pareto-group-label">Scenarios by number of shots</div>
                <ParetoPlot
                  recommendations={result.recommendations}
                  frontIds={frontIds}
                  selectedShots={selectedShots}
                  onSelect={setSelectedShots}
                />

                {selected && (
                  <div className="coverage-result" aria-live="polite">
                    <div className="coverage-result-head">
                      <div>
                        <span className="coverage-kicker">Selected scenario</span>
                        <h3>
                          {selected.injections} {selected.injections === 1 ? 'shot' : 'shots'} for{' '}
                          {windowLabel}
                        </h3>
                      </div>
                      {loading && <span className="coverage-refresh">Updating…</span>}
                    </div>
                    <div className="pd-metrics">
                      <div>
                        <span className="pd-label">Average level over period</span>
                        <span className="pd-val primary">{selected.meanLevel.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="pd-label">Lowest level in period</span>
                        <span className="pd-val">{selected.lowestLevel.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="pd-label">Factor used</span>
                        <span className="pd-val">{selected.totalIU} IU</span>
                      </div>
                      <div>
                        <span className="pd-label">Time below {referenceLevel || '0'}%</span>
                        <span className="pd-val">
                          {selected.timeBelowReference < 0.05
                            ? '0 h'
                            : `${selected.timeBelowReference.toFixed(1)} h`}
                        </span>
                      </div>
                    </div>

                    {selectedCurve && (
                      <div className="coverage-chart">
                        <h4 className="chart-caption">Predicted factor level over {windowLabel}</h4>
                        <FactorChart
                          curves={[selectedCurve]}
                          activeId={selectedCurve.id}
                          height={240}
                          windowHours={result.windowHours}
                          referenceLevel={Number(referenceLevel)}
                          title={`Predicted Factor VIII level for the ${selected.injections}-shot scenario`}
                        />
                      </div>
                    )}

                    <div className="coverage-schedule">
                      {selected.refills.map((refill) => (
                        <div className="coverage-schedule-row" key={refill.startsAt.toISOString()}>
                          <span>{formatLocalWeeklyInfusion(refill.startsAt)}</span>
                          <strong>{refill.iu} IU</strong>
                        </div>
                      ))}
                    </div>

                    {!selected.meetsReference && Number(referenceLevel) > 0 && (
                      <p className="coverage-warning">
                        This scenario falls below the minimum factor level during the selected
                        period.
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="pareto-empty">
                No scenario fits within this dose limit and these dose sizes.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
