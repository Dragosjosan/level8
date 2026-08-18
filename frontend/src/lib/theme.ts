import type { Accent } from '../types'

export const ACCENT_OPTIONS: ReadonlyArray<{
  id: Accent
  label: string
  color: string
}> = [
  { id: 'teal', label: 'Teal', color: 'oklch(0.58 0.12 210)' },
  { id: 'indigo', label: 'Indigo', color: 'oklch(0.55 0.13 265)' },
  { id: 'green', label: 'Green', color: 'oklch(0.58 0.13 155)' },
  { id: 'amber', label: 'Amber', color: 'oklch(0.62 0.14 75)' },
  { id: 'slate', label: 'Slate', color: 'oklch(0.45 0.03 260)' },
]

export function getAccentColor(accent: Accent): string {
  return ACCENT_OPTIONS.find((option) => option.id === accent)?.color ?? ACCENT_OPTIONS[0]!.color
}
