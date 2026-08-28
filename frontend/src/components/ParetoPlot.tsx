import type { ParetoCandidate } from '../types'

interface ParetoPlotProps {
  recommendations: ParetoCandidate[]
  bestFitId: string | null
  bestFitLabel: string
  selectedInfusions: number | null
  onSelect: (infusions: number) => void
}

export function ParetoPlot({
  recommendations,
  bestFitId,
  bestFitLabel,
  selectedInfusions,
  onSelect,
}: ParetoPlotProps) {
  const maximumMean = Math.max(0, ...recommendations.map((candidate) => candidate.meanLevel))

  return (
    <div className="coverage-options" aria-label="Infusion scenarios for the activity period">
      {recommendations.map((candidate) => {
        const width = maximumMean > 0 ? Math.max(3, (candidate.meanLevel / maximumMean) * 100) : 0
        const isBestFit = candidate.id === bestFitId

        return (
          <button
            key={candidate.id}
            type="button"
            className={`coverage-option ${candidate.injections === selectedInfusions ? 'active ' : ''}${isBestFit ? 'best-fit' : ''}`}
            aria-pressed={candidate.injections === selectedInfusions}
            onClick={() => onSelect(candidate.injections)}
          >
            <span className="coverage-option-top">
              <strong className="coverage-option-title">
                {candidate.injections} {candidate.injections === 1 ? 'infusion' : 'infusions'}
              </strong>
              {isBestFit && <span className="best-fit-badge">{bestFitLabel}</span>}
            </span>
            <span className="coverage-option-average">
              <strong>{candidate.meanLevel.toFixed(1)}%</strong>
              <span>average</span>
            </span>
            <span className="coverage-bar" aria-hidden="true">
              <span style={{ width: `${width}%` }} />
            </span>
            <span className="coverage-option-meta">
              <span>{candidate.totalIU} IU total</span>
              <span>lowest {candidate.lowestLevel.toFixed(1)}%</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
