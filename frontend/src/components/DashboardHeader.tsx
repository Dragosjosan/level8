import type { ComputedCurve } from '../types'
import { MedTabs } from './MedTabs'

interface DashboardHeaderProps {
  curves: ComputedCurve[]
  activeCurve: ComputedCurve | null
  onSelect: (curveId: string) => void
  onAdd?: () => void
  onEdit?: () => void
}

export function DashboardHeader({
  curves,
  activeCurve,
  onSelect,
  onAdd,
  onEdit,
}: DashboardHeaderProps) {
  return (
    <header className="page-top">
      <h1 className="page-title">Factor&nbsp;VIII</h1>
      <MedTabs
        curves={curves}
        activeId={activeCurve?.id ?? null}
        onSelect={onSelect}
        onAdd={onAdd}
      />
      {activeCurve && onEdit && (
        <button type="button" className="btn btn-ghost edit-link" onClick={onEdit}>
          Edit {activeCurve.name}
        </button>
      )}
    </header>
  )
}
