import { getCurrentCurvePoint } from '../lib/curveData'
import type { ComputedCurve } from '../types'

interface CompareTableProps {
  curves: ComputedCurve[]
  activeId: string | null
  currentTime: Date
  onSelect: (curveId: string) => void
  onToggleVisibility: (curveId: string) => void
}

export function CompareTable({
  curves,
  activeId,
  currentTime,
  onSelect,
  onToggleVisibility,
}: CompareTableProps) {
  return (
    <section className="compare-block" aria-labelledby="compare-heading">
      <h2 className="block-label" id="compare-heading">
        Products
      </h2>
      <div className="compare-table">
        <div className="compare-row head" aria-hidden="true">
          <span>Product</span>
          <span>Per week</span>
          <span>Now</span>
          <span>Peak</span>
          <span>Half-life</span>
          <span>Average</span>
        </div>

        {curves.map((curve) => {
          const isActive = curve.id === activeId
          const currentLevel = getCurrentCurvePoint(curve.data, currentTime).level

          return (
            <div
              key={curve.id}
              className={`compare-row ${isActive ? 'active ' : ''}${curve.visible ? '' : 'dim'}`}
            >
              <span className="compare-name">
                <button
                  type="button"
                  className="vis-toggle"
                  style={{
                    backgroundColor: curve.visible ? curve.color : 'transparent',
                    borderColor: curve.color,
                  }}
                  aria-label={`${curve.visible ? 'Hide' : 'Show'} ${curve.name} on chart`}
                  aria-pressed={curve.visible}
                  onClick={() => onToggleVisibility(curve.id)}
                />
                <button
                  type="button"
                  className="compare-select"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => onSelect(curve.id)}
                >
                  {curve.name}
                </button>
              </span>
              <span className="num">{curve.weeklyInfusions.length}×</span>
              <span className="num strong">{currentLevel.toFixed(1)}%</span>
              <span className="num">{curve.data.peak.toFixed(0)}%</span>
              <span className="num">
                {curve.data.halvingTime === null ? '—' : `${curve.data.halvingTime.toFixed(1)}h`}
              </span>
              <span className="num">{curve.data.meanLevel.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
