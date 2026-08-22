import type { ParetoCandidate } from '../types'

interface ParetoPlotProps {
  recommendations: ParetoCandidate[]
  frontIds: Set<string>
  selectedShots: number
  onSelect: (shots: number) => void
}

function signedChange(value: number): string {
  if (Math.abs(value) < 0.05) {
    return 'no average change'
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(1)}% average`
}

export function ParetoPlot({
  recommendations,
  frontIds,
  selectedShots,
  onSelect,
}: ParetoPlotProps) {
  const maximumMean = Math.max(0, ...recommendations.map((candidate) => candidate.meanLevel))

  return (
    <div
      className="coverage-options"
      aria-label="Average factor level over the activity period by number of shots"
    >
      {recommendations.map((candidate, index) => {
        const previous = recommendations[index - 1]
        const change = previous ? candidate.meanLevel - previous.meanLevel : 0
        const width = maximumMean > 0 ? Math.max(3, (candidate.meanLevel / maximumMean) * 100) : 0

        return (
          <button
            key={candidate.id}
            type="button"
            className={`coverage-option ${candidate.injections === selectedShots ? 'active' : ''}`}
            aria-pressed={candidate.injections === selectedShots}
            onClick={() => onSelect(candidate.injections)}
          >
            <span className="coverage-option-head">
              <strong>
                {candidate.injections} {candidate.injections === 1 ? 'shot' : 'shots'}
              </strong>
              <span className="coverage-option-value">
                {candidate.meanLevel.toFixed(1)}% average
              </span>
            </span>
            <span className="coverage-bar" aria-hidden="true">
              <span style={{ width: `${width}%` }} />
            </span>
            <span className="coverage-option-note">
              {index === 0 ? `${candidate.totalIU} IU total` : signedChange(change)}
              {frontIds.has(candidate.id) && <em>Efficient trade-off</em>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
