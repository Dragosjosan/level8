import { getCurrentCurvePoint } from '../lib/curveData'
import type { ComputedCurve } from '../types'

interface CompareTableProps {
  curves: ComputedCurve[]
  activeId: string | null
  currentTime: Date
  onSelect: (curveId: string) => void
  onToggleVisibility: (curveId: string) => void
}

function VisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M2.25 10s2.7-4.5 7.75-4.5 7.75 4.5 7.75 4.5-2.7 4.5-7.75 4.5S2.25 10 2.25 10Z" />
      <circle cx="10" cy="10" r="2.25" />
      {!visible && <path d="m3.5 3.5 13 13" />}
    </svg>
  )
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
                    color: curve.color,
                  }}
                  aria-label={`${curve.visible ? 'Hide' : 'Show'} ${curve.name} on chart`}
                  aria-pressed={curve.visible}
                  onClick={() => onToggleVisibility(curve.id)}
                >
                  <VisibilityIcon visible={curve.visible} />
                </button>
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
