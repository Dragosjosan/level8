import { useCallback, useEffect, useState } from 'react'
import { Button } from './components/Button'
import { CompareTable } from './components/CompareTable'
import { CurveEditor } from './components/CurveEditor'
import { DashboardHeader } from './components/DashboardHeader'
import { ErrorState, LoadingState } from './components/DashboardState'
import { FactorChart } from './components/FactorChart'
import { MedicineToolbar } from './components/MedicineToolbar'
import { ParetoSection } from './components/ParetoSection'
import { StatsRow } from './components/StatsRow'
import { useDashboard } from './hooks/useDashboard'
import { useDisplayPreferences } from './hooks/useDisplayPreferences'
import { getHoursUntilNextInfusion } from './lib/curveData'
import { formatLocalWeeklyInfusion, sortWeeklyInfusions } from './lib/dateTime'
import { getAccentColor } from './lib/theme'

function App() {
  const display = useDisplayPreferences()
  const dashboard = useDashboard({ onSettingsLoaded: display.applyCanonicalPreferences })
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [editorCurveId, setEditorCurveId] = useState<string | null | undefined>(undefined)

  const closeEditor = useCallback(() => setEditorCurveId(undefined), [])

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
        <div className="page-heading">
          <DashboardHeader />
          {activeCurve && (
            <MedicineToolbar
              curves={dashboard.computedCurves}
              activeCurve={activeCurve}
              onAdd={() => setEditorCurveId(null)}
              onEdit={(curveId) => setEditorCurveId(curveId)}
              onSelect={dashboard.setActiveId}
            />
          )}
        </div>
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
              </div>

              <FactorChart
                curves={dashboard.computedCurves}
                activeId={dashboard.activeId}
                currentTime={currentTime}
              />

              {dashboard.computedCurves.length > 1 && (
                <div className="legend" aria-label="Chart products">
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
            <ParetoSection activeCurve={activeCurve} />
          </>
        ) : (
          <section className="empty-state">
            <span className="empty-kicker">No products</span>
            <h2>No products in this scenario.</h2>
            <p>Add a product or reset to the database defaults to continue.</p>
            <Button variant="primary" onClick={() => setEditorCurveId(null)}>
              Add product
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
    </>
  )
}

export default App
