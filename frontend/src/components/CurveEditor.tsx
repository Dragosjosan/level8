import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { getBrowserTimeZone, getFixedWeekHour } from '../lib/dateTime'
import { getErrorMessage } from '../lib/errors'
import type { ComputedCurve, CurveInput } from '../types'
import { Button } from './Button'

interface CurveEditorProps {
  initial: ComputedCurve | null
  defaultColor: string
  onClose: () => void
  onDelete: (curveId: string) => void
  onSave: (input: CurveInput, curveId: string | null) => Promise<string>
}

interface InfusionField {
  id: string
  weekday: number
  time: string
}

interface EditorForm {
  name: string
  peakLevel: string
  timeElapsed: string
  measuredLevel: string
  weeklyInfusions: InfusionField[]
  color: string
  constant: boolean
}

interface ValidationErrors {
  name?: string
  peakLevel?: string
  timeElapsed?: string
  measuredLevel?: string
  weeklyInfusions?: string
}

const COLOR_OPTIONS = [
  { value: 'oklch(0.58 0.12 210)', label: 'Teal' },
  { value: 'oklch(0.62 0.14 150)', label: 'Green' },
  { value: 'oklch(0.58 0.14 30)', label: 'Coral' },
  { value: 'oklch(0.55 0.15 300)', label: 'Violet' },
  { value: 'oklch(0.62 0.14 80)', label: 'Amber' },
  { value: 'oklch(0.5 0.05 260)', label: 'Slate' },
] as const

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
] as const

const LOCAL_TIME_PATTERN = /^(\d{2}):(\d{2})$/
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

function createInfusionId(): string {
  return crypto.randomUUID()
}

function toLocalTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function createInfusionField(weekday = 1, time = '07:30'): InfusionField {
  return { id: createInfusionId(), weekday, time }
}

function resolveInfusionDate(infusion: InfusionField): Date | null {
  const match = LOCAL_TIME_PATTERN.exec(infusion.time)

  if (
    !match ||
    !Number.isInteger(infusion.weekday) ||
    infusion.weekday < 0 ||
    infusion.weekday > 6
  ) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (hours > 23 || minutes > 59) {
    return null
  }

  const now = new Date()
  const monday = new Date(now)
  const daysSinceMonday = (monday.getDay() + 6) % 7
  const dayOffset = (infusion.weekday + 6) % 7

  monday.setDate(monday.getDate() - daysSinceMonday)
  monday.setHours(0, 0, 0, 0)

  const result = new Date(monday)
  result.setDate(monday.getDate() + dayOffset)
  result.setHours(hours, minutes, 0, 0)

  const matchesInput =
    result.getDay() === infusion.weekday &&
    result.getHours() === hours &&
    result.getMinutes() === minutes

  return matchesInput ? result : null
}

function createForm(initial: ComputedCurve | null, defaultColor: string): EditorForm {
  if (initial) {
    return {
      name: initial.name,
      peakLevel: String(initial.peakLevel),
      timeElapsed: String(initial.timeElapsed),
      measuredLevel: String(initial.measuredLevel),
      weeklyInfusions: initial.weeklyInfusions.map((infusion) => {
        const weekHour = getFixedWeekHour(infusion.startsAt, initial.data.windowStart)
        const occurrence = new Date(
          initial.data.windowStart.getTime() + weekHour * MILLISECONDS_PER_HOUR,
        )

        return createInfusionField(occurrence.getDay(), toLocalTime(occurrence))
      }),
      color: initial.color,
      constant: initial.constant,
    }
  }

  return {
    name: '',
    peakLevel: '110',
    timeElapsed: '168',
    measuredLevel: '10',
    weeklyInfusions: [createInfusionField()],
    color: defaultColor,
    constant: false,
  }
}

function positiveNumber(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function validate(form: EditorForm): ValidationErrors {
  const errors: ValidationErrors = {}
  const peakLevel = positiveNumber(form.peakLevel)

  if (!form.name.trim()) {
    errors.name = 'Enter a medicine name.'
  }

  if (peakLevel === null) {
    errors.peakLevel = 'Enter a level greater than zero.'
  }

  if (!form.constant) {
    const timeElapsed = positiveNumber(form.timeElapsed)
    const measuredLevel = positiveNumber(form.measuredLevel)

    if (timeElapsed === null) {
      errors.timeElapsed = 'Enter an elapsed time greater than zero.'
    }

    if (measuredLevel === null) {
      errors.measuredLevel = 'Enter a measured level greater than zero.'
    } else if (peakLevel !== null && measuredLevel >= peakLevel) {
      errors.measuredLevel = 'The measured level must be lower than the peak.'
    }
  }

  if (
    form.weeklyInfusions.length === 0 ||
    form.weeklyInfusions.some((infusion) => resolveInfusionDate(infusion) === null)
  ) {
    errors.weeklyInfusions = 'Enter at least one valid local infusion weekday and time.'
  }

  return errors
}

export function CurveEditor({
  initial,
  defaultColor,
  onClose,
  onDelete,
  onSave,
}: CurveEditorProps) {
  const titleId = useId()
  const descriptionId = useId()
  const nameErrorId = useId()
  const peakErrorId = useId()
  const timeErrorId = useId()
  const measuredErrorId = useId()
  const infusionErrorId = useId()
  const panelRef = useRef<HTMLDialogElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState(() => createForm(initial, defaultColor))
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.classList.add('modal-open')
    nameInputRef.current?.focus()

    return () => {
      document.body.classList.remove('modal-open')
      previousFocus?.focus()
    }
  }, [])

  function update<K extends keyof EditorForm>(key: K, value: EditorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSubmitError(null)
  }

  function updateInfusion(id: string, changes: Partial<Omit<InfusionField, 'id'>>) {
    setForm((current) => ({
      ...current,
      weeklyInfusions: current.weeklyInfusions.map((infusion) =>
        infusion.id === id ? { ...infusion, ...changes } : infusion,
      ),
    }))
    setErrors((current) => ({ ...current, weeklyInfusions: undefined }))
    setSubmitError(null)
  }

  function addInfusion() {
    const previous = form.weeklyInfusions.at(-1)
    const nextWeekday = previous ? (previous.weekday + 1) % 7 : 1
    const nextTime = previous?.time ?? '07:30'

    update('weeklyInfusions', [...form.weeklyInfusions, createInfusionField(nextWeekday, nextTime)])
  }

  function removeInfusion(id: string) {
    if (form.weeklyInfusions.length === 1) {
      return
    }

    update(
      'weeklyInfusions',
      form.weeklyInfusions.filter((infusion) => infusion.id !== id),
    )
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
      ) ?? [],
    ).filter((element) => element.tabIndex !== -1)

    if (focusable.length === 0) {
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate(form)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const peakLevel = Number(form.peakLevel)
    const weeklyInfusions = form.weeklyInfusions.map((infusion) => ({
      startsAt: resolveInfusionDate(infusion)!,
    }))
    const input: CurveInput = {
      name: form.name.trim(),
      peakLevel,
      timeElapsed: form.constant ? 168 : Number(form.timeElapsed),
      measuredLevel: form.constant ? peakLevel : Number(form.measuredLevel),
      weeklyInfusions,
      color: form.color,
      visible: initial?.visible ?? true,
      constant: form.constant,
    }

    setIsSaving(true)
    setSubmitError(null)

    try {
      await onSave(input, initial?.id ?? null)
      onClose()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'The medicine could not be calculated.'))
      setIsSaving(false)
    }
  }

  function handleDelete() {
    if (!initial) {
      return
    }

    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }

    onDelete(initial.id)
    onClose()
  }

  const timeZone = getBrowserTimeZone()

  return (
    <>
      <div className="sidepanel-scrim open" aria-hidden="true" onClick={onClose} />
      <dialog
        ref={panelRef}
        className="sidepanel open"
        open
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handlePanelKeyDown}
      >
        <form className="sidepanel-form" noValidate onSubmit={handleSubmit}>
          <header className="sidepanel-head">
            <div>
              <h2 className="eyebrow" id={titleId}>
                {initial ? 'Edit medicine' : 'Add new medicine'}
              </h2>
              <p className="sidepanel-intro" id={descriptionId}>
                Changes create a temporary scenario. Database defaults stay unchanged.
              </p>
            </div>
            <button type="button" className="iconbtn" onClick={onClose}>
              <span aria-hidden="true">✕</span>
              <span className="sr-only">Close medicine editor</span>
            </button>
          </header>

          <div className="sidepanel-body">
            <label className="field">
              <span className="field-label">Medicine name</span>
              <input
                ref={nameInputRef}
                className="input"
                value={form.name}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? nameErrorId : undefined}
                autoComplete="off"
                placeholder="e.g. Altuvoct"
                onChange={(event) => update('name', event.target.value)}
              />
              {errors.name && (
                <span className="field-error" id={nameErrorId}>
                  {errors.name}
                </span>
              )}
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={form.constant}
                onChange={(event) => update('constant', event.target.checked)}
              />
              <span>
                Constant level
                <span className="check-note">
                  Flat line at the entered level, without decay or infusion stacking.
                </span>
              </span>
            </label>

            <h3 className="section-label">{form.constant ? 'Level' : 'Measurement'}</h3>

            <div className="field-row">
              <label className="field">
                <span className="field-label">{form.constant ? 'Level' : 'Peak level'}</span>
                <div className="input-affix">
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={form.peakLevel}
                    aria-invalid={Boolean(errors.peakLevel)}
                    aria-describedby={errors.peakLevel ? peakErrorId : undefined}
                    onChange={(event) => update('peakLevel', event.target.value)}
                  />
                  <span className="affix">%</span>
                </div>
                {errors.peakLevel && (
                  <span className="field-error" id={peakErrorId}>
                    {errors.peakLevel}
                  </span>
                )}
              </label>

              {!form.constant && (
                <label className="field">
                  <span className="field-label">Time elapsed</span>
                  <div className="input-affix">
                    <input
                      type="number"
                      className="input"
                      min="0"
                      step="1"
                      inputMode="decimal"
                      value={form.timeElapsed}
                      aria-invalid={Boolean(errors.timeElapsed)}
                      aria-describedby={errors.timeElapsed ? timeErrorId : undefined}
                      onChange={(event) => update('timeElapsed', event.target.value)}
                    />
                    <span className="affix">hrs</span>
                  </div>
                  {errors.timeElapsed && (
                    <span className="field-error" id={timeErrorId}>
                      {errors.timeElapsed}
                    </span>
                  )}
                </label>
              )}
            </div>

            {!form.constant && (
              <label className="field field-spaced">
                <span className="field-label">Measured level after that time</span>
                <div className="input-affix">
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={form.measuredLevel}
                    aria-invalid={Boolean(errors.measuredLevel)}
                    aria-describedby={errors.measuredLevel ? measuredErrorId : undefined}
                    onChange={(event) => update('measuredLevel', event.target.value)}
                  />
                  <span className="affix">%</span>
                </div>
                {errors.measuredLevel && (
                  <span className="field-error" id={measuredErrorId}>
                    {errors.measuredLevel}
                  </span>
                )}
              </label>
            )}

            <div className="section-label section-label-row">
              <h3>Weekly infusions</h3>
              <button type="button" className="linkbtn" onClick={addInfusion}>
                + Add infusion
              </button>
            </div>
            <p className="timezone-note">
              Choose a recurring weekday and local time in {timeZone}. The schedule is sent to the
              API as a fixed 168-hour UTC interval.
            </p>

            <div className="infusion-list">
              {form.weeklyInfusions.map((infusion, index) => (
                <fieldset key={infusion.id} className="field infusion-field">
                  <legend className="field-label">Infusion {index + 1}</legend>
                  <span className="infusion-row">
                    <select
                      className="input"
                      value={infusion.weekday}
                      aria-label={`Infusion ${index + 1} weekday`}
                      aria-invalid={Boolean(errors.weeklyInfusions)}
                      aria-describedby={errors.weeklyInfusions ? infusionErrorId : undefined}
                      onChange={(event) =>
                        updateInfusion(infusion.id, { weekday: Number(event.target.value) })
                      }
                    >
                      {WEEKDAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      className="input"
                      step="60"
                      value={infusion.time}
                      aria-label={`Infusion ${index + 1} local time`}
                      aria-invalid={Boolean(errors.weeklyInfusions)}
                      aria-describedby={errors.weeklyInfusions ? infusionErrorId : undefined}
                      onChange={(event) =>
                        updateInfusion(infusion.id, { time: event.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="iconbtn ghost"
                      disabled={form.weeklyInfusions.length === 1}
                      onClick={() => removeInfusion(infusion.id)}
                    >
                      <span aria-hidden="true">✕</span>
                      <span className="sr-only">Remove infusion {index + 1}</span>
                    </button>
                  </span>
                </fieldset>
              ))}
            </div>
            {errors.weeklyInfusions && (
              <p className="field-error" id={infusionErrorId}>
                {errors.weeklyInfusions}
              </p>
            )}

            <fieldset className="color-fieldset">
              <legend className="section-label">Curve color</legend>
              <div className="swatch-row">
                {COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`swatch ${form.color === option.value ? 'active' : ''}`}
                    style={{ backgroundColor: option.value }}
                    aria-label={`${option.label} curve color`}
                    aria-pressed={form.color === option.value}
                    onClick={() => update('color', option.value)}
                  />
                ))}
              </div>
            </fieldset>

            {submitError && (
              <p className="editor-error" role="alert">
                {submitError}
              </p>
            )}
          </div>

          <footer className="sidepanel-foot">
            {initial && (
              <div className="delete-action">
                <Button variant="danger" onClick={handleDelete}>
                  {deleteArmed ? 'Confirm delete' : 'Delete'}
                </Button>
                {deleteArmed && <output>This removes it from the temporary scenario.</output>}
              </div>
            )}
            <div className="spacer" />
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" loading={isSaving} type="submit">
              {initial ? 'Save changes' : 'Save medicine'}
            </Button>
          </footer>
        </form>
      </dialog>
    </>
  )
}
