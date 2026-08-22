import type { Curve } from '../types'

interface MedTabsProps {
  curves: Curve[]
  activeId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string) => void
}

export function MedTabs({ curves, activeId, onSelect, onEdit }: MedTabsProps) {
  return (
    <nav className="med-tabs" aria-label="Products">
      {curves.map((curve) => {
        const isActive = curve.id === activeId

        return (
          <button
            key={curve.id}
            type="button"
            className={`med-tab ${isActive ? 'active' : ''}`}
            aria-pressed={isActive}
            onClick={() => {
              onSelect(curve.id)
              onEdit(curve.id)
            }}
          >
            <span className="dot" style={{ backgroundColor: curve.color }} aria-hidden="true" />
            {curve.name}
          </button>
        )
      })}
    </nav>
  )
}
