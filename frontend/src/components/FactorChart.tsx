import { useId, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotProps,
  type MouseHandlerDataParam,
  type TooltipContentProps,
} from 'recharts'
import { downloadChartAsPng } from '../lib/chartExport'
import { getCurrentCurvePoint, interpolateLevel } from '../lib/curveData'
import type { CurveComputation } from '../types'
import { Button } from './Button'

export interface FactorChartCurve {
  id: string
  name: string
  color: string
  visible: boolean
  data: Pick<CurveComputation, 'windowStart' | 'hours' | 'levels' | 'refillHours'>
}

interface FactorChartProps {
  curves: FactorChartCurve[]
  activeId: string | null
  currentTime?: Date
  height?: number
  windowHours?: number
  referenceLevel?: number
  title?: string
  pngFileName?: string
}

interface ChartPoint {
  hour: number
  levels: Record<string, number>
}

interface CurrentPoint {
  curve: FactorChartCurve
  hour: number
  level: number
  active: boolean
}

interface ChartTooltipProps extends Pick<TooltipContentProps, 'active' | 'label'> {
  curves: FactorChartCurve[]
  windowStart: Date
}

interface NowMarkerProps extends DotProps {
  color: string
  label: string
  labelOffsetY: number
  active: boolean
  flip: boolean
  hideLabel: boolean
}

const HOURS_IN_WEEK = 168
const Y_AXIS_STEP = 25
const Y_AXIS_MINIMUM = 125
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
const CHART_MARGIN = { top: 26, right: 18, bottom: 8, left: 0 }
const X_AXIS_HEIGHT = 30
const NOW_LABEL_DEFAULT_OFFSET = -10
const NOW_LABEL_GAP = 14
const NOW_LABEL_MIN_BASELINE = 12

function pngNameFromTitle(title: string): string {
  const baseName = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${baseName || 'factor-viii-chart'}.png`
}

const tooltipTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
})

function dateAtHour(windowStart: Date, hour: number): Date {
  return new Date(windowStart.getTime() + hour * MILLISECONDS_PER_HOUR)
}

function buildChartData(curves: FactorChartCurve[], windowHours: number): ChartPoint[] {
  const hours = new Set<number>([0, windowHours])

  for (const curve of curves) {
    for (const hour of curve.data.hours) {
      hours.add(hour)
    }
  }

  return [...hours]
    .sort((left, right) => left - right)
    .map((hour) => ({
      hour,
      levels: Object.fromEntries(
        curves.map((curve) => [curve.id, interpolateLevel(curve.data, hour)]),
      ),
    }))
}

function getYAxisScale(
  curves: FactorChartCurve[],
  referenceLevel?: number,
): { maximum: number; ticks: number[] } {
  const highest = curves.reduce(
    (maximum, curve) => Math.max(maximum, ...curve.data.levels),
    Math.max(20, referenceLevel ?? 0),
  )
  // Always a 25% step so the labels stay round, never tighter than 0-125%,
  // and grown a step at a time once the curve needs the room.
  const maximum = Math.max(Y_AXIS_MINIMUM, Math.ceil((highest * 1.02) / Y_AXIS_STEP) * Y_AXIS_STEP)

  return {
    maximum,
    ticks: Array.from({ length: maximum / Y_AXIS_STEP + 1 }, (_, index) => index * Y_AXIS_STEP),
  }
}

function getNowLabelOffsets(
  points: CurrentPoint[],
  maximumLevel: number,
  chartHeight: number,
): Map<string, number> {
  const plotHeight = Math.max(
    1,
    chartHeight - CHART_MARGIN.top - CHART_MARGIN.bottom - X_AXIS_HEIGHT,
  )
  const maximumBaseline = CHART_MARGIN.top + plotHeight - 4
  const labels = points
    .map((point) => {
      const markerY = CHART_MARGIN.top + (1 - Math.max(0, point.level) / maximumLevel) * plotHeight
      return {
        id: point.curve.id,
        markerY,
        desiredY: markerY + NOW_LABEL_DEFAULT_OFFSET,
        active: point.active,
      }
    })
    .sort(
      (left, right) => left.desiredY - right.desiredY || Number(right.active) - Number(left.active),
    )

  const positions = labels.map((label) => label.desiredY)
  for (let index = 1; index < positions.length; index += 1) {
    positions[index] = Math.max(positions[index], positions[index - 1] + NOW_LABEL_GAP)
  }

  if (positions.length > 0 && positions[positions.length - 1] > maximumBaseline) {
    positions[positions.length - 1] = maximumBaseline
    for (let index = positions.length - 2; index >= 0; index -= 1) {
      positions[index] = Math.min(positions[index], positions[index + 1] - NOW_LABEL_GAP)
    }
  }

  if (positions.length > 0 && positions[0] < NOW_LABEL_MIN_BASELINE) {
    positions[0] = NOW_LABEL_MIN_BASELINE
    for (let index = 1; index < positions.length; index += 1) {
      positions[index] = Math.max(positions[index], positions[index - 1] + NOW_LABEL_GAP)
    }
  }

  return new Map(labels.map((label, index) => [label.id, positions[index] - label.markerY]))
}

function ChartTooltip({ active, label, curves, windowStart }: ChartTooltipProps) {
  const hour = typeof label === 'number' ? label : Number(label)

  if (!active || !Number.isFinite(hour)) {
    return null
  }

  return (
    <div className="chart-tip">
      <time className="chart-tip-time" dateTime={dateAtHour(windowStart, hour).toISOString()}>
        {tooltipTimeFormatter.format(dateAtHour(windowStart, hour))}
      </time>
      {curves.map((curve) => (
        <div key={curve.id} className="chart-tip-row">
          <span
            className="swatch-line"
            style={{ backgroundColor: curve.color }}
            aria-hidden="true"
          />
          <span className="chart-tip-name">{curve.name}</span>
          <span className="chart-tip-val">{interpolateLevel(curve.data, hour).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

function NowMarker({
  cx,
  cy,
  color,
  label,
  labelOffsetY,
  active,
  flip,
  hideLabel,
}: NowMarkerProps) {
  if (cx === undefined || cy === undefined) {
    return <g />
  }

  return (
    <g className="now-marker" aria-hidden="true">
      <circle
        cx={cx}
        cy={cy}
        r={active ? 5 : 4}
        fill="var(--surface)"
        stroke={color}
        strokeWidth={2}
      />
      <circle cx={cx} cy={cy} r={active ? 2 : 1.5} fill={color} />
      {!hideLabel && (
        <text
          x={cx + (flip ? -10 : 10)}
          y={cy + labelOffsetY}
          fill={active ? 'var(--ink)' : color}
          fontFamily="var(--font-mono)"
          fontSize={active ? 11 : 10}
          textAnchor={flip ? 'end' : 'start'}
        >
          {label}
        </text>
      )}
    </g>
  )
}

export function FactorChart({
  curves,
  activeId,
  currentTime,
  height = 320,
  windowHours = HOURS_IN_WEEK,
  referenceLevel,
  title = 'Factor VIII level',
  pngFileName,
}: FactorChartProps) {
  const descriptionId = useId()
  const visualRef = useRef<HTMLDivElement>(null)
  const [tooltipActive, setTooltipActive] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const visibleCurves = useMemo(() => curves.filter((curve) => curve.visible), [curves])
  const chartData = useMemo(
    () => buildChartData(visibleCurves, windowHours),
    [visibleCurves, windowHours],
  )
  const { maximum: maximumLevel, ticks: yTicks } = useMemo(
    () => getYAxisScale(visibleCurves, referenceLevel),
    [referenceLevel, visibleCurves],
  )
  const dayCenters = useMemo(
    () =>
      Array.from({ length: Math.ceil(windowHours / 24) }, (_, index) => index * 24 + 12).filter(
        (hour) => hour < windowHours,
      ),
    [windowHours],
  )
  const dayDividers = useMemo(
    () =>
      Array.from({ length: Math.floor(windowHours / 24) }, (_, index) => (index + 1) * 24).filter(
        (hour) => hour < windowHours,
      ),
    [windowHours],
  )
  const currentPoints = useMemo<CurrentPoint[]>(
    () =>
      currentTime
        ? visibleCurves.map((curve) => ({
            curve,
            ...getCurrentCurvePoint(curve.data, currentTime),
            active: curve.id === activeId,
          }))
        : [],
    [activeId, currentTime, visibleCurves],
  )
  const nowLabelOffsets = useMemo(
    () => getNowLabelOffsets(currentPoints, maximumLevel, height),
    [currentPoints, height, maximumLevel],
  )
  const windowStart = visibleCurves[0]?.data.windowStart ?? curves[0]?.data.windowStart

  if (visibleCurves.length === 0 || !windowStart) {
    return (
      <output className="chart-empty">
        All products are hidden. Use the comparison table or legend to show a curve.
      </output>
    )
  }

  function handleMouseMove(state: MouseHandlerDataParam) {
    setTooltipActive(state.isTooltipActive)
  }

  async function handlePngExport() {
    const svg = visualRef.current?.querySelector('svg')
    if (!svg) {
      setExportError('The chart is not ready to save yet.')
      return
    }

    setIsExporting(true)
    setExportError(null)
    try {
      await downloadChartAsPng(svg, pngFileName ?? pngNameFromTitle(title))
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The chart could not be saved.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <figure className="factor-chart" aria-describedby={descriptionId}>
      <figcaption className="sr-only" id={descriptionId}>
        {title}. Hover or use the chart keyboard controls for point details.
      </figcaption>
      <div className="factor-chart-actions">
        <Button
          className="btn-compact"
          loading={isExporting}
          onClick={() => void handlePngExport()}
        >
          Save PNG
        </Button>
      </div>
      <div ref={visualRef} className="factor-chart-visual" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={CHART_MARGIN}
            accessibilityLayer
            title={title}
            cursor="crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltipActive(false)}
          >
            <CartesianGrid vertical={false} stroke="var(--hairline)" strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="hour"
              domain={[0, windowHours]}
              ticks={dayCenters}
              interval={0}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              tickFormatter={(hour) => dayFormatter.format(dateAtHour(windowStart, hour))}
            />
            <YAxis
              type="number"
              domain={[0, maximumLevel]}
              ticks={yTicks}
              width={44}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              label={{
                value: '%',
                position: 'top',
                offset: 12,
                fill: 'var(--muted)',
                fontSize: 10,
              }}
            />

            {dayDividers.map((hour) => (
              <ReferenceLine key={hour} x={hour} stroke="var(--hairline)" zIndex={50} />
            ))}

            {referenceLevel !== undefined && referenceLevel > 0 && (
              <ReferenceLine
                y={referenceLevel}
                stroke="var(--accent)"
                strokeDasharray="4 3"
                strokeOpacity={0.65}
                zIndex={100}
              />
            )}

            {visibleCurves
              .filter((curve) => curve.id !== activeId)
              .map((curve) => (
                <Line
                  key={curve.id}
                  id={`curve-${curve.id}`}
                  type="linear"
                  dataKey={(point: ChartPoint) => point.levels[curve.id]}
                  name={curve.name}
                  stroke={curve.color}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  strokeOpacity={0.75}
                  dot={false}
                  activeDot={{
                    r: 3.5,
                    fill: 'var(--surface)',
                    stroke: curve.color,
                    strokeWidth: 2,
                  }}
                  isAnimationActive="auto"
                />
              ))}

            {visibleCurves
              .filter((curve) => curve.id === activeId)
              .map((curve) => (
                <Line
                  key={curve.id}
                  id={`curve-${curve.id}`}
                  type="linear"
                  dataKey={(point: ChartPoint) => point.levels[curve.id]}
                  name={curve.name}
                  stroke={curve.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 3.5,
                    fill: 'var(--surface)',
                    stroke: curve.color,
                    strokeWidth: 2,
                  }}
                  isAnimationActive="auto"
                />
              ))}

            {visibleCurves
              .filter((curve) => curve.id === activeId)
              .flatMap((curve) =>
                curve.data.refillHours.map((hour, index) => (
                  <ReferenceLine
                    key={`${curve.id}-${hour}-${index}`}
                    segment={[
                      { x: hour, y: 0 },
                      { x: hour, y: maximumLevel * 0.025 },
                    ]}
                    stroke={curve.color}
                    strokeWidth={2}
                    zIndex={500}
                  />
                )),
              )}

            {currentPoints
              .filter((point) => point.active)
              .map((point) => (
                <ReferenceLine
                  key={`now-line-${point.curve.id}`}
                  x={point.hour}
                  stroke="var(--ink)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.45}
                  zIndex={450}
                />
              ))}

            {currentPoints.map((point) => (
              <ReferenceDot
                key={`now-${point.curve.id}`}
                x={point.hour}
                y={point.level}
                ifOverflow="extendDomain"
                zIndex={650}
                shape={(props) => (
                  <NowMarker
                    {...props}
                    color={point.curve.color}
                    label={`${point.active ? 'now · ' : ''}${point.level.toFixed(1)}%`}
                    labelOffsetY={nowLabelOffsets.get(point.curve.id) ?? NOW_LABEL_DEFAULT_OFFSET}
                    active={point.active}
                    flip={point.hour > 142}
                    hideLabel={tooltipActive}
                  />
                )}
              />
            ))}

            <Tooltip
              content={(props) => (
                <ChartTooltip {...props} curves={visibleCurves} windowStart={windowStart} />
              )}
              cursor={{ stroke: 'var(--muted)', strokeOpacity: 0.45 }}
              isAnimationActive={false}
              allowEscapeViewBox={{ x: false, y: true }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {exportError && (
        <p className="chart-export-error" role="alert">
          {exportError}
        </p>
      )}
    </figure>
  )
}
