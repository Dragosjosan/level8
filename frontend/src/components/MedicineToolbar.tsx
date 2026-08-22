import type { ComputedCurve } from '../types'
import { Button } from './Button'
import { MedTabs } from './MedTabs'

interface MedicineToolbarProps {
  curves: ComputedCurve[]
  activeCurve: ComputedCurve
  onAdd: () => void
  onEdit: (curveId: string) => void
  onSelect: (curveId: string) => void
}

export function MedicineToolbar({
  curves,
  activeCurve,
  onAdd,
  onEdit,
  onSelect,
}: MedicineToolbarProps) {
  return (
    <div className="medicine-toolbar">
      <MedTabs curves={curves} activeId={activeCurve.id} onSelect={onSelect} onEdit={onEdit} />
      <div className="medicine-toolbar-actions">
        <Button onClick={() => onEdit(activeCurve.id)}>Edit {activeCurve.name}</Button>
        <Button onClick={onAdd}>
          <span aria-hidden="true">+</span>
          Add product
        </Button>
      </div>
    </div>
  )
}
