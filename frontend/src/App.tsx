import { useEffect, useState } from 'react'
import { DashboardHeader } from './components/DashboardHeader'
import { ErrorState, LoadingState } from './components/DashboardState'
import { StatsRow } from './components/StatsRow'
import { useDashboard } from './hooks/useDashboard'
import { useDisplayPreferences } from './hooks/useDisplayPreferences'
import { getHoursUntilNextInfusion } from './lib/curveData'

function App() {
  const { applyCanonicalPreferences } = useDisplayPreferences()
  const dashboard = useDashboard({ onSettingsLoaded: applyCanonicalPreferences })
  const [currentTime, setCurrentTime] = useState(() => new Date())

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

  return (
    <main className="page">
      <DashboardHeader
        curves={dashboard.computedCurves}
        activeCurve={activeCurve}
        onSelect={dashboard.setActiveId}
      />

      {activeCurve ? (
        <StatsRow
          curve={activeCurve}
          currentTime={currentTime}
          hoursUntilNextInfusion={getHoursUntilNextInfusion(activeCurve.data, currentTime)}
        />
      ) : (
        <section className="empty-state">
          <span className="empty-kicker">No medicines</span>
          <h2>No database defaults are available.</h2>
          <p>Add a canonical medicine through the API before building a temporary scenario.</p>
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
  )
}

export default App
