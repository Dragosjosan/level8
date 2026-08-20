import { useId, useMemo, useState } from 'react'
import {
  Area,
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
import { getCurrentCurvePoint, interpolateLevel } from '../lib/curveData'
import type { ComputedCurve, CurveStyle } from '../types'

interface FactorChartProps {
  curves: ComputedCurve[]
  activeId: string | null
  curveStyle: CurveStyle
  currentTime: Date
  height?: number
}

interface ChartPoint {
  hour: number
  levels: Record<string, number>
}

interface CurrentPoint {
  curve: ComputedCurve
  hour: number
  level: number
  active: boolean
}

interface ChartTooltipProps extends Pick<TooltipContentProps, 'active' | 'label'> {
  curves: ComputedCurve[]
  windowStart: Date
}

interface NowMarkerProps extends DotProps {
  color: string
  label: string
  active: boolean
  flip: boolean
  hideLabel: boolean
}

const HOURS_IN_WEEK = 168
const DAY_HOURS = [0, 24, 48, 72, 96, 120, 144] as const
const DAY_CENTERS = [12, 36, 60, 84, 108, 132, 156] as const
const DAY_DIVIDERS = [24, 48, 72, 96, 120, 144] as const
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000

const tooltipTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'shortOffset',
})

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
})

const tableTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function dateAtHour(windowStart: Date, hour: number): Date {
  return new Date(windowStart.getTime() + hour * MILLISECONDS_PER_HOUR)
}

function buildChartData(curves: ComputedCurve[]): ChartPoint[] {
  const hours = new Set<number>([0, HOURS_IN_WEEK])

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

function getMaximumLevel(curves: ComputedCurve[]): number {
  const highest = curves.reduce((maximum, curve) => Math.max(maximum, ...curve.data.levels), 20)

  return Math.ceil((highest * 1.12) / 20) * 20
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

function NowMarker({ cx, cy, color, label, active, flip, hideLabel }: NowMarkerProps) {
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
          y={cy - 10}
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
  curveStyle,
  currentTime,
  height = 320,
}: FactorChartProps) {
  const descriptionId = useId()
  const [tooltipActive, setTooltipActive] = useState(false)
  const visibleCurves = useMemo(() => curves.filter((curve) => curve.visible), [curves])
  const chartData = useMemo(() => buildChartData(visibleCurves), [visibleCurves])
  const maximumLevel = useMemo(() => getMaximumLevel(visibleCurves), [visibleCurves])
  const yTicks = useMemo(
    () => Array.from({ length: 6 }, (_, index) => (maximumLevel / 5) * index),
    [maximumLevel],
  )
  const currentPoints = useMemo<CurrentPoint[]>(
    () =>
      visibleCurves.map((curve) => ({
        curve,
        ...getCurrentCurvePoint(curve.data, currentTime),
        active: curve.id === activeId,
      })),
    [activeId, currentTime, visibleCurves],
  )
  const windowStart = visibleCurves[0]?.data.windowStart ?? curves[0]?.data.windowStart
  const lineType = 'linear'

  if (visibleCurves.length === 0 || !windowStart) {
    return (
      <output className="chart-empty">
        All medicines are hidden. Use the comparison table or legend to show a curve.
      </output>
    )
  }

  function handleMouseMove(state: MouseHandlerDataParam) {
    setTooltipActive(state.isTooltipActive)
  }

  return (
    <figure className="factor-chart" aria-describedby={descriptionId}>
      <figcaption className="sr-only" id={descriptionId}>
        Predicted Factor VIII levels across a fixed 168-hour week. Use the chart keyboard controls
        for point details or open the weekly data table below.
      </figcaption>
      <div className="factor-chart-visual" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 26, right: 18, bottom: 8, left: 0 }}
            accessibilityLayer
            title="Factor VIII level across the week"
            cursor="crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltipActive(false)}
          >
            <CartesianGrid vertical={false} stroke="var(--hairline)" strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="hour"
              domain={[0, HOURS_IN_WEEK]}
              ticks={DAY_CENTERS}
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

            {DAY_DIVIDERS.map((hour) => (
              <ReferenceLine key={hour} x={hour} stroke="var(--hairline)" zIndex={50} />
            ))}

            {visibleCurves
              .filter((curve) => curve.id !== activeId)
              .map((curve) => (
                <Line
                  key={curve.id}
                  id={`curve-${curve.id}`}
                  type={lineType}
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
              .map((curve) =>
                curveStyle === 'area' ? (
                  <Area
                    key={curve.id}
                    id={`curve-${curve.id}`}
                    type="linear"
                    dataKey={(point: ChartPoint) => point.levels[curve.id]}
                    name={curve.name}
                    stroke={curve.color}
                    strokeWidth={2}
                    fill={curve.color}
                    fillOpacity={0.1}
                    dot={false}
                    activeDot={{
                      r: 3.5,
                      fill: 'var(--surface)',
                      stroke: curve.color,
                      strokeWidth: 2,
                    }}
                    isAnimationActive="auto"
                  />
                ) : (
                  <Line
                    key={curve.id}
                    id={`curve-${curve.id}`}
                    type={lineType}
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
                ),
              )}

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

    </figure>
  )
}
