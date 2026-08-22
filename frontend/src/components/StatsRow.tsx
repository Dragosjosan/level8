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
  unit?: string
  note?: string
  primary?: boolean
  textual?: boolean
}

const nextInfusionFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24

function formatRelativeHours(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * MINUTES_PER_HOUR))
  const days = Math.floor(totalMinutes / (HOURS_PER_DAY * MINUTES_PER_HOUR))
  const remainingMinutes = totalMinutes % (HOURS_PER_DAY * MINUTES_PER_HOUR)
  const remainingHours = Math.floor(remainingMinutes / MINUTES_PER_HOUR)
  const minutes = remainingMinutes % MINUTES_PER_HOUR

  if (days > 0) {
    return `${days}d${remainingHours > 0 ? ` ${remainingHours}h` : ''}`
  }

  if (remainingHours > 0) {
    return `${remainingHours}h${minutes > 0 ? ` ${minutes}m` : ''}`
  }

  return `${minutes}m`
}

function Stat({ label, value, unit, note, primary = false, textual = false }: StatProps) {
  return (
    <div className={`stat ${primary ? 'primary ' : ''}${textual ? 'textual' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        <span className="n">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="stat-note">{note ?? ''}</div>
    </div>
  )
}

export function StatsRow({ curve, currentTime, hoursUntilNextInfusion }: StatsRowProps) {
  const currentPoint = getCurrentCurvePoint(curve.data, currentTime)
  const nextInfusion =
    hoursUntilNextInfusion === null
      ? null
      : new Date(currentTime.getTime() + hoursUntilNextInfusion * MILLISECONDS_PER_HOUR)

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
        value={nextInfusion === null ? '—' : nextInfusionFormatter.format(nextInfusion)}
        note={
          hoursUntilNextInfusion === null
            ? undefined
            : `in ${formatRelativeHours(hoursUntilNextInfusion)}`
        }
        textual
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
