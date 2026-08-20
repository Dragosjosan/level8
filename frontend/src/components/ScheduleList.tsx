import {
  getBrowserTimeZone,
  getFixedWeekHour,
  sortWeeklyInfusions,
  toUtcDateTime,
} from '../lib/dateTime'
import type { ComputedCurve } from '../types'

interface ScheduleListProps {
  curve: ComputedCurve
}

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
})

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

export function ScheduleList({ curve }: ScheduleListProps) {
  const infusions = sortWeeklyInfusions(curve.weeklyInfusions, curve.data.windowStart)

  return (
    <section className="schedule-block" aria-labelledby="schedule-heading">
      <h2 className="block-label" id="schedule-heading">
        Infusion schedule
      </h2>
      <div className="schedule-list">
        {infusions.map((infusion) => {
          const weekHour = getFixedWeekHour(infusion.startsAt, curve.data.windowStart)
          const occurrence = new Date(
            curve.data.windowStart.getTime() + weekHour * MILLISECONDS_PER_HOUR,
          )

          return (
            <div key={toUtcDateTime(infusion.startsAt)} className="schedule-row">
              <span className="schedule-when">
                <span className="schedule-day">{weekdayFormatter.format(occurrence)}</span>
                {' at '}
                <time className="schedule-time" dateTime={toUtcDateTime(occurrence)}>
                  {timeFormatter.format(occurrence)}
                </time>
              </span>
              <span className="schedule-dose">{curve.peakLevel}% peak</span>
            </div>
          )
        })}
      </div>
      <p className="schedule-timezone">Times shown in {getBrowserTimeZone()}.</p>
    </section>
  )
}
