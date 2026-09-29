'use client';

import { useId, useMemo, useState } from 'react';
import { formatPaiseCompact, formatPaiseShort } from '@/lib/money';
import { cn, formatNumber } from '@/lib/utils';

/**
 * Categorical series colours, assigned in fixed order and never cycled.
 * Validated for lightness band, chroma floor, CVD separation, normal-vision
 * separation and contrast against the light chart surface.
 */
export const SERIES_COLORS = [
  '#A8365A',
  '#C2871F',
  '#00958A',
  '#3A6DC4',
  '#8C8A00',
  '#B0559A',
] as const;

const OTHER_COLOR = '#8D8A85';
const AXIS = '#C0BEBB';
const GRID = '#EDE8E2';
const INK = '#3A3733';
const INK_MUTED = '#8D8A85';

export function seriesColor(index: number): string {
  return index < SERIES_COLORS.length ? SERIES_COLORS[index] : OTHER_COLOR;
}

/* ------------------------------------------------------------------ trend */

export interface TrendDatum {
  label: string;
  revenue: number;
  orders: number;
}

/**
 * Revenue over time. One measure, one axis — orders are surfaced in the
 * tooltip rather than on a second y-scale.
 */
export function RevenueTrendChart({
  data,
  height = 220,
  metric = 'revenue',
}: {
  data: TrendDatum[];
  height?: number;
  metric?: 'revenue' | 'orders';
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const padding = { top: 16, right: 12, bottom: 26, left: 52 };
  const width = 720;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const values = data.map((point) => (metric === 'revenue' ? point.revenue : point.orders));
  const max = Math.max(1, ...values);
  const niceMax = niceCeil(max);

  const x = (index: number) =>
    padding.left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
  const y = (value: number) => padding.top + innerHeight - (value / niceMax) * innerHeight;

  const linePath = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(values[index]).toFixed(1)}`)
    .join(' ');

  const areaPath =
    data.length > 0
      ? `${linePath} L${x(data.length - 1).toFixed(1)},${padding.top + innerHeight} L${x(0).toFixed(1)},${
          padding.top + innerHeight
        } Z`
      : '';

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => niceMax * fraction);

  // Label roughly every eighth point, always including the last one. Dropping the
  // regular label that lands too near the end stops the two from colliding
  // (e.g. "02 Sep" printed on top of "04 Sep" on a 31-day range).
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const lastIndex = data.length - 1;
  const labelIndexes = new Set<number>();
  for (let index = 0; index < data.length; index += labelEvery) {
    if (lastIndex - index >= labelEvery / 2) labelIndexes.add(index);
  }
  labelIndexes.add(lastIndex);

  if (data.length === 0) {
    return <ChartEmpty height={height} message="No sales in this period yet." />;
  }

  return (
    <figure className="relative m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${metric === 'revenue' ? 'Revenue' : 'Orders'} trend across ${data.length} periods`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity="0.20" />
            <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={GRID}
              strokeWidth="1"
            />
            <text x={padding.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="10" fill={INK_MUTED}>
              {metric === 'revenue' ? formatPaiseCompact(tick) : Math.round(tick)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={SERIES_COLORS[0]}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((point, index) => (
          <g key={point.label + index}>
            {labelIndexes.has(index) ? (
              <text
                x={x(index)}
                y={height - 8}
                textAnchor={index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'}
                fontSize="10"
                fill={INK_MUTED}
              >
                {point.label}
              </text>
            ) : null}
            <rect
              x={x(index) - innerWidth / Math.max(1, data.length) / 2}
              y={padding.top}
              width={innerWidth / Math.max(1, data.length)}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          </g>
        ))}

        {hover !== null ? (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padding.top}
              y2={padding.top + innerHeight}
              stroke={AXIS}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={x(hover)} cy={y(values[hover])} r="5" fill="#FFFFFF" stroke={SERIES_COLORS[0]} strokeWidth="2" />
          </g>
        ) : null}
      </svg>

      {hover !== null ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-taupe-100 bg-white px-2.5 py-1.5 text-xs shadow-popover"
          style={{
            left: `${(x(hover) / width) * 100}%`,
            top: 4,
          }}
        >
          <p className="font-medium text-charcoal-700">{data[hover].label}</p>
          <p className="text-charcoal-500">{formatPaiseShort(data[hover].revenue)}</p>
          <p className="text-charcoal-400">
            {formatNumber(data[hover].orders)} order{data[hover].orders === 1 ? '' : 's'}
          </p>
        </div>
      ) : null}
    </figure>
  );
}

/* ------------------------------------------------------------------ donut */

export interface SliceDatum {
  name: string;
  value: number;
  share: number;
}

export function RevenueDonut({
  data,
  total,
  height = 220,
}: {
  data: SliceDatum[];
  total: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  // More than six categories folds into "Other" rather than inventing hues.
  const slices = useMemo(() => {
    if (data.length <= 6) return data;
    const head = data.slice(0, 5);
    const tail = data.slice(5);
    return [
      ...head,
      {
        name: 'Other',
        value: tail.reduce((sum, slice) => sum + slice.value, 0),
        share: tail.reduce((sum, slice) => sum + slice.share, 0),
      },
    ];
  }, [data]);

  if (slices.length === 0 || total === 0) {
    return <ChartEmpty height={height} message="No category revenue yet." />;
  }

  const size = 180;
  const radius = 74;
  const thickness = 24;
  const center = size / 2;
  const gapDegrees = 1.6;

  let angle = -90;
  const arcs = slices.map((slice, index) => {
    const sweep = (slice.share / 100) * 360;
    const start = angle + gapDegrees / 2;
    const end = angle + sweep - gapDegrees / 2;
    angle += sweep;
    return { slice, start: Math.min(start, end), end, color: index === 5 && slices.length === 6 && slice.name === 'Other' ? OTHER_COLOR : seriesColor(index) };
  });

  return (
    <figure className="m-0 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label="Revenue by category"
        className="shrink-0"
      >
        {arcs.map((arc, index) => (
          <path
            key={arc.slice.name}
            d={describeArc(center, center, radius, arc.start, arc.end)}
            fill="none"
            stroke={arc.color}
            strokeWidth={hover === index ? thickness + 4 : thickness}
            strokeLinecap="butt"
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
            className="cursor-default transition-[stroke-width] duration-150"
          />
        ))}
        <text x={center} y={center - 4} textAnchor="middle" fontSize="18" fill={INK} fontWeight="600">
          {formatPaiseCompact(hover === null ? total : slices[hover].value)}
        </text>
        <text x={center} y={center + 14} textAnchor="middle" fontSize="10" fill={INK_MUTED}>
          {hover === null ? 'Total revenue' : slices[hover].name}
        </text>
      </svg>

      <ul className="w-full min-w-0 space-y-1.5">
        {arcs.map((arc, index) => (
          <li
            key={arc.slice.name}
            className={cn(
              'flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors',
              hover === index && 'bg-ivory-50',
            )}
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: arc.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-charcoal-600">{arc.slice.name}</span>
            <span className="tabular-nums text-charcoal-400">{arc.slice.share.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* -------------------------------------------------------------------- bar */

export function CategoryBarChart({
  data,
  height = 240,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <ChartEmpty height={height} message="No data for this period." />;

  const width = 720;
  const padding = { top: 14, right: 12, bottom: 42, left: 56 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = niceCeil(Math.max(1, ...data.map((row) => row.value)));

  const slot = innerWidth / data.length;
  const barWidth = Math.min(46, slot - 10);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => max * fraction);
  const y = (value: number) => padding.top + innerHeight - (value / max) * innerHeight;

  return (
    <figure className="relative m-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} role="img" aria-label="Revenue by category">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke={GRID} />
            <text x={padding.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="10" fill={INK_MUTED}>
              {formatPaiseCompact(tick)}
            </text>
          </g>
        ))}

        {data.map((row, index) => {
          const barHeight = Math.max(2, padding.top + innerHeight - y(row.value));
          const barX = padding.left + index * slot + (slot - barWidth) / 2;
          return (
            <g key={row.name} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
              <rect
                x={barX}
                y={y(row.value)}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill={seriesColor(index)}
                opacity={hover === null || hover === index ? 1 : 0.55}
              />
              <text
                x={barX + barWidth / 2}
                y={height - 26}
                textAnchor="middle"
                fontSize="10"
                fill={INK_MUTED}
              >
                {truncateLabel(row.name)}
              </text>
              <text
                x={barX + barWidth / 2}
                y={height - 12}
                textAnchor="middle"
                fontSize="10"
                fill={INK}
              >
                {formatPaiseCompact(row.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/* ---------------------------------------------------------------- helpers */

function ChartEmpty({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-taupe-200 text-xs text-charcoal-300"
      style={{ height }}
    >
      {message}
    </div>
  );
}

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function truncateLabel(value: string): string {
  return value.length > 12 ? `${value.slice(0, 11)}…` : value;
}

function polarToCartesian(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
