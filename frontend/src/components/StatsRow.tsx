import { getCurrentCurvePoint } from '../lib/curveData'
import type { ComputedCurve } from '../types'

interface StatsRowProps {
  curve: ComputedCurve
  currentTime: Date
  hoursUntilNextInfusion: number | null
}

interface StatProps {
  label: string
  value: string | number
  unit: string
  note?: string
  primary?: boolean
}

function Stat({ label, value, unit, note, primary = false }: StatProps) {
  return (
    <div className={`stat ${primary ? 'primary' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        <span className="n">{value}</span>
        <span className="unit">{unit}</span>
      </div>
      <div className="stat-note">{note ?? ''}</div>
    </div>
  )
}

export function StatsRow({ curve, currentTime, hoursUntilNextInfusion }: StatsRowProps) {
  const currentPoint = getCurrentCurvePoint(curve.data, currentTime)

  return (
    <section className="stats-row" aria-label="Weekly summary">
      <Stat label="Current level" value={currentPoint.level.toFixed(1)} unit="%" primary />
      <Stat label="Peak this week" value={curve.data.peak.toFixed(0)} unit="%" />
      <Stat
        label="Infusions / week"
        value={curve.weeklyInfusions.length}
        unit={curve.weeklyInfusions.length === 1 ? 'dose' : 'doses'}
      />
      <Stat
        label="Next infusion"
        value={hoursUntilNextInfusion === null ? '—' : hoursUntilNextInfusion.toFixed(1)}
        unit="h"
      />
      <Stat
        label="Average level"
        value={curve.data.meanLevel.toFixed(1)}
        unit="%"
        note={`low ${curve.data.trough.toFixed(1)}%`}
      />
    </section>
  )
}
