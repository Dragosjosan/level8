import { useCallback, useEffect, useRef, useState } from 'react'
import { getAccentColor } from '../lib/theme'
import type { Accent, Density, Settings, Skin, Theme } from '../types'

const STORAGE_KEY = 'factor-viii-display-preferences-v1'

export interface DisplayPreferences {
  theme: Theme
  accent: Accent
  density: Density
  skin: Skin
}

const DEFAULT_PREFERENCES: DisplayPreferences = {
  theme: 'light',
  accent: 'teal',
  density: 'spacious',
  skin: 'clinical',
}

const ALLOWED_VALUES = {
  theme: ['light', 'dark'],
  accent: ['teal', 'indigo', 'green', 'amber', 'slate'],
  density: ['spacious', 'compact'],
  skin: ['clinical', 'document'],
} as const

function isAllowedValue<K extends keyof typeof ALLOWED_VALUES>(
  key: K,
  value: unknown,
): value is DisplayPreferences[K] {
  return (ALLOWED_VALUES[key] as readonly unknown[]).includes(value)
}

function readStoredPreferences(): DisplayPreferences | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')

    if (value === null || typeof value !== 'object') {
      return null
    }

    const stored = value as Record<string, unknown>

    return {
      theme: isAllowedValue('theme', stored.theme) ? stored.theme : DEFAULT_PREFERENCES.theme,
      accent: isAllowedValue('accent', stored.accent) ? stored.accent : DEFAULT_PREFERENCES.accent,
      density: isAllowedValue('density', stored.density)
        ? stored.density
        : DEFAULT_PREFERENCES.density,
      skin: isAllowedValue('skin', stored.skin) ? stored.skin : DEFAULT_PREFERENCES.skin,
    }
  } catch {
    return null
  }
}

function settingsToPreferences(settings: Settings): DisplayPreferences {
  return {
    theme: settings.theme,
    accent: settings.accent,
    density: settings.density,
    skin: settings.skin,
  }
}

export function useDisplayPreferences() {
  const storedPreferences = useRef(readStoredPreferences())
  const [preferences, setPreferences] = useState(storedPreferences.current ?? DEFAULT_PREFERENCES)

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme
    document.documentElement.dataset.density = preferences.density
    document.documentElement.dataset.skin = preferences.skin

    if (preferences.skin === 'document') {
      document.documentElement.style.removeProperty('--accent')
    } else {
      document.documentElement.style.setProperty('--accent', getAccentColor(preferences.accent))
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      return
    }
  }, [preferences])

  const applyCanonicalPreferences = useCallback((settings: Settings) => {
    if (storedPreferences.current === null) {
      setPreferences(settingsToPreferences(settings))
    }
  }, [])

  function updatePreference<K extends keyof DisplayPreferences>(
    key: K,
    value: DisplayPreferences[K],
  ) {
    storedPreferences.current = { ...preferences, [key]: value }
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  return { preferences, updatePreference, applyCanonicalPreferences }
}
