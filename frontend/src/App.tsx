import { useCallback, useEffect, useState } from 'react'
import { Button } from './components/Button'
import { CompareTable } from './components/CompareTable'
import { CurveEditor } from './components/CurveEditor'
import { DashboardHeader } from './components/DashboardHeader'
import { ErrorState, LoadingState } from './components/DashboardState'
import { FactorChart } from './components/FactorChart'
import { ScheduleList } from './components/ScheduleList'
import { StatsRow } from './components/StatsRow'
import { Tweaks } from './components/Tweaks'
import { useDashboard } from './hooks/useDashboard'
import { useDisplayPreferences } from './hooks/useDisplayPreferences'
import { getHoursUntilNextInfusion } from './lib/curveData'
import { formatLocalWeeklyInfusion, sortWeeklyInfusions } from './lib/dateTime'
import { getAccentColor } from './lib/theme'
import type { CurveStyle } from './types'

const CURVE_STYLE_OPTIONS: ReadonlyArray<{ value: CurveStyle; label: string }> = [
  { value: 'area', label: 'Area' },
  { value: 'line', label: 'Line' },
]

function App() {
  const display = useDisplayPreferences()
  const dashboard = useDashboard({ onSettingsLoaded: display.applyCanonicalPreferences })
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [editorCurveId, setEditorCurveId] = useState<string | null | undefined>(undefined)
  const [tweaksOpen, setTweaksOpen] = useState(false)

  const closeEditor = useCallback(() => setEditorCurveId(undefined), [])
  const closeTweaks = useCallback(() => setTweaksOpen(false), [])
  const openTweaks = useCallback(() => setTweaksOpen(true), [])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  if (dashboard.status === 'loading') {
    return <LoadingState />
  }

  if (dashboard.status === 'error') {
    return (
      <ErrorState
        message={dashboard.error ?? 'The dashboard could not be loaded.'}
        onRetry={() => void dashboard.loadDefaults()}
      />
    )
  }

  const activeCurve = dashboard.activeCurve
  const editingCurve =
    editorCurveId === null
      ? null
      : (dashboard.computedCurves.find((curve) => curve.id === editorCurveId) ?? null)
  const infusionSummary = activeCurve
    ? sortWeeklyInfusions(activeCurve.weeklyInfusions, activeCurve.data.windowStart)
        .map((infusion) => formatLocalWeeklyInfusion(infusion.startsAt))
        .join(', ')
    : ''

  return (
    <>
      <main className="page">
        <DashboardHeader
          curves={dashboard.computedCurves}
          activeCurve={activeCurve}
          onSelect={dashboard.setActiveId}
          onAdd={() => setEditorCurveId(null)}
          onEdit={activeCurve ? () => setEditorCurveId(activeCurve.id) : undefined}
        />

        {dashboard.isModified && (
          <section className="scenario-status" aria-label="Temporary scenario status">
            <div>
              <strong>Temporary scenario</strong>
              <span>These changes exist only in this browser session.</span>
            </div>
            <Button onClick={() => void dashboard.loadDefaults()}>
              Reset to database defaults
            </Button>
          </section>
        )}

        {activeCurve ? (
          <>
            <StatsRow
              curve={activeCurve}
              currentTime={currentTime}
              hoursUntilNextInfusion={getHoursUntilNextInfusion(activeCurve.data, currentTime)}
            />
            <section className="chart-block" aria-labelledby="chart-heading">
              <div className="chart-block-head">
                <h2 className="chart-caption" id="chart-heading">
                  {activeCurve.constant
                    ? `Constant level · ${activeCurve.peakLevel}% · ${infusionSummary}`
                    : `Level across the week · infusion ${infusionSummary}`}
                </h2>
                <fieldset className="seg">
                  <legend className="sr-only">Curve style</legend>
                  {CURVE_STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={display.preferences.curveStyle === option.value ? 'active' : ''}
                      aria-pressed={display.preferences.curveStyle === option.value}
                      onClick={() => display.updatePreference('curveStyle', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </fieldset>
              </div>

              <FactorChart
                curves={dashboard.computedCurves}
                activeId={dashboard.activeId}
                curveStyle={display.preferences.curveStyle}
                currentTime={currentTime}
              />

              {dashboard.computedCurves.length > 1 && (
                <div className="legend" aria-label="Chart medicines">
                  {dashboard.computedCurves.map((curve) => (
                    <button
                      key={curve.id}
                      type="button"
                      className={`legend-item ${curve.visible ? '' : 'dim'}`}
                      aria-pressed={curve.visible}
                      onClick={() => dashboard.toggleCurveVisibility(curve.id)}
                    >
                      <span
                        className="swatch-line"
                        style={{ backgroundColor: curve.color }}
                        aria-hidden="true"
                      />
                      {curve.name}
                      <span className="badge">
                        {curve.data.halvingTime === null
                          ? 'constant'
                          : `t½ ${curve.data.halvingTime.toFixed(1)}h`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <CompareTable
              curves={dashboard.computedCurves}
              activeId={dashboard.activeId}
              currentTime={currentTime}
              onSelect={dashboard.setActiveId}
              onToggleVisibility={dashboard.toggleCurveVisibility}
            />
            <ScheduleList curve={activeCurve} />
          </>
        ) : (
          <section className="empty-state">
            <span className="empty-kicker">No medicines</span>
            <h2>No medicines in this scenario.</h2>
            <p>Add a medicine or reset to the database defaults to continue.</p>
            <Button variant="primary" onClick={() => setEditorCurveId(null)}>
              Add medicine
            </Button>
          </section>
        )}

        <footer className="disclosure">
          <strong>Educational model, not medical advice.</strong>
          <span>
            Estimates use a simplified mono-exponential, additive-dose model and are not dosing
            recommendations.
          </span>
        </footer>
      </main>

      {editorCurveId !== undefined && (
        <CurveEditor
          key={editorCurveId ?? 'new'}
          initial={editingCurve}
          defaultColor={getAccentColor(display.preferences.accent)}
          onClose={closeEditor}
          onDelete={dashboard.deleteCurve}
          onSave={dashboard.saveCurve}
        />
      )}

      <Tweaks
        open={tweaksOpen}
        preferences={display.preferences}
        onChange={display.updatePreference}
        onClose={closeTweaks}
        onOpen={openTweaks}
      />
    </>
  )
}

export default App
