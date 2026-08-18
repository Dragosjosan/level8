export const HOURS_IN_WEEK = 168

const MILLISECONDS_PER_HOUR = 1000 * 60 * 60
const MILLISECONDS_PER_WEEK = MILLISECONDS_PER_HOUR * HOURS_IN_WEEK

const UTC_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

const localFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'shortOffset',
})

export function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime())
}

export function parseUtcDateTime(value: string): Date | null {
  if (!UTC_DATE_TIME_PATTERN.test(value)) {
    return null
  }

  const parsed = new Date(value)

  return isValidDate(parsed) ? parsed : null
}

export function requireUtcDateTime(value: string, field: string): Date {
  const date = parseUtcDateTime(value)

  if (date === null) {
    throw new TypeError(`Invalid UTC datetime received for ${field}`)
  }

  return date
}

export function toUtcDateTime(date: Date): string {
  if (!isValidDate(date)) {
    throw new RangeError('Invalid date')
  }
  return date.toISOString()
}

export function fromLocalDateTimeInput(value: string): Date | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value)

  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute] = match
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  }

  const date = new Date(
    parts.year,
    parts.month - 1, // JS uses 0 based months
    parts.day,
    parts.hour,
    parts.minute,
  )

  const matchesInput =
    date.getFullYear() === parts.year &&
    date.getMonth() === parts.month - 1 &&
    date.getDate() === parts.day &&
    date.getHours() === parts.hour &&
    date.getMinutes() === parts.minute

  return matchesInput ? date : null
}

export function toLocalDateTimeInput(date: Date): string {
  if (!isValidDate(date)) {
    throw new RangeError('Invalid date')
  }

  const pad = (value: number) => String(value).padStart(2, '0')

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('')
}

export function formatLocalDateTime(date: Date): string {
  if (!isValidDate(date)) {
    throw new RangeError('Invalid date')
  }

  return localFormatter.format(date)
}

export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function getFixedWeekHour(instant: Date, anchor: Date): number {
  if (!isValidDate(instant) || !isValidDate(anchor)) {
    throw RangeError('Could not fix invalid date')
  }

  const elapsed = instant.getTime() - anchor.getTime()

  const wrapped =
    ((elapsed % MILLISECONDS_PER_WEEK) + MILLISECONDS_PER_WEEK) % MILLISECONDS_PER_WEEK

  return wrapped / MILLISECONDS_PER_HOUR
}

export function sortWeeklyInfusions<T extends { startsAt: Date }>(
  infusions: T[],
  windowStart: Date,
): T[] {
  return [...infusions].sort(
    (left, right) =>
      getFixedWeekHour(left.startsAt, windowStart) - getFixedWeekHour(right.startsAt, windowStart),
  )
}
