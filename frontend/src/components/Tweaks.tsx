import { useEffect, useRef } from 'react'
import type { DisplayPreferences } from '../hooks/useDisplayPreferences'
import { ACCENT_OPTIONS } from '../lib/theme'
import type { Accent, CurveStyle, Density, Skin, Theme } from '../types'

interface TweaksProps {
  open: boolean
  preferences: DisplayPreferences
  onChange: <K extends keyof DisplayPreferences>(key: K, value: DisplayPreferences[K]) => void
  onClose: () => void
  onOpen: () => void
}

interface ChoiceGroupProps<T extends string> {
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

const SKIN_OPTIONS: ReadonlyArray<{ value: Skin; label: string }> = [
  { value: 'clinical', label: 'Clinical' },
  { value: 'document', label: 'Document' },
]

const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const CURVE_STYLE_OPTIONS: ReadonlyArray<{ value: CurveStyle; label: string }> = [
  { value: 'area', label: 'Area' },
  { value: 'line', label: 'Line' },
]

const DENSITY_OPTIONS: ReadonlyArray<{ value: Density; label: string }> = [
  { value: 'spacious', label: 'Spacious' },
  { value: 'compact', label: 'Compact' },
]

function ChoiceGroup<T extends string>({ label, options, value, onChange }: ChoiceGroupProps<T>) {
  return (
    <fieldset className="tweak-row">
      <legend className="field-label">{label}</legend>
      <div className="seg-sm">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === value ? 'active' : ''}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Tweaks({ open, preferences, onChange, onClose, onOpen }: TweaksProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        triggerRef.current?.focus()
        wasOpenRef.current = false
      }
      return
    }

    wasOpenRef.current = true
    closeRef.current?.focus()

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, open])

  if (!open) {
    return (
      <button ref={triggerRef} type="button" className="btn tweaks-trigger" onClick={onOpen}>
        Display tweaks
      </button>
    )
  }

  return (
    <section className="tweaks" aria-labelledby="tweaks-heading">
      <header className="tweaks-head">
        <h2 id="tweaks-heading">Tweaks</h2>
        <button ref={closeRef} type="button" className="iconbtn ghost" onClick={onClose}>
          <span aria-hidden="true">✕</span>
          <span className="sr-only">Close display tweaks</span>
        </button>
      </header>
      <div className="tweaks-body">
        <ChoiceGroup
          label="Skin"
          options={SKIN_OPTIONS}
          value={preferences.skin}
          onChange={(value) => onChange('skin', value)}
        />
        <ChoiceGroup
          label="Theme"
          options={THEME_OPTIONS}
          value={preferences.theme}
          onChange={(value) => onChange('theme', value)}
        />

        <fieldset className="tweak-row" disabled={preferences.skin === 'document'}>
          <legend className="field-label">Accent</legend>
          <div className="accent-row">
            {ACCENT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={preferences.accent === option.id ? 'active' : ''}
                style={{ backgroundColor: option.color }}
                aria-label={`${option.label} accent`}
                aria-pressed={preferences.accent === option.id}
                onClick={() => onChange('accent', option.id as Accent)}
              />
            ))}
          </div>
          {preferences.skin === 'document' && (
            <span className="tweak-note">Document skin uses its own accent.</span>
          )}
        </fieldset>

        <ChoiceGroup
          label="Curve style"
          options={CURVE_STYLE_OPTIONS}
          value={preferences.curveStyle}
          onChange={(value) => onChange('curveStyle', value)}
        />
        <ChoiceGroup
          label="Density"
          options={DENSITY_OPTIONS}
          value={preferences.density}
          onChange={(value) => onChange('density', value)}
        />
      </div>
    </section>
  )
}
