import type { Curve } from '../types'

interface MedTabsProps {
  curves: Curve[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd?: () => void
}

export function MedTabs({ curves, activeId, onSelect, onAdd }: MedTabsProps) {
  return (
    <nav className="med-tabs" aria-label="Medicines">
      {curves.map((curve) => {
        const isActive = curve.id === activeId

        return (
          <button
            key={curve.id}
            type="button"
            className={`med-tab ${isActive ? 'active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onSelect(curve.id)}
          >
            <span className="dot" style={{ backgroundColor: curve.color }} aria-hidden="true" />
            {curve.name}
          </button>
        )
      })}

      {onAdd && (
        <button type="button" className="med-tab add" onClick={onAdd}>
          <span aria-hidden="true">+</span>
          Add medicine
        </button>
      )}
    </nav>
  )
}
