/** Storage % full chart: this winter, scenario projection, previous winters' range and average. */
import * as Plot from '@observablehq/plot';
import type { PathPoint, RangePoint } from '../lib/storage';
import { COLORS, PLOT_STYLE } from './NetbackCharts';
import PlotFigure from './PlotFigure';

/** Previous winters: ocean-blue band and line, so this winter's teal stands out. */
const BAND = COLORS.ocean;
const BAND_OPACITY = 0.14;
const AVG = COLORS.ocean;

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmtDay = (iso: string) => toDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

interface Props {
  actual: { day: string; full: number }[];
  projection: PathPoint[];
  range: RangePoint[];
  rangeLabel: string;
}

export default function StorageChart({ actual, projection, range, rangeLabel }: Props) {
  const last = actual[actual.length - 1];
  // Join the projection to the last actual point so the lines connect.
  const proj = last ? [{ day: last.day, full: last.full }, ...projection.map((p) => ({ day: p.day, full: p.full }))] : [];
  const end = projection[projection.length - 1];
  const byDay = new Map<string, { day: string; actual?: number; proj?: number; min: number; max: number; avg: number }>();
  for (const r of range) byDay.set(r.day, { day: r.day, min: r.min, max: r.max, avg: r.avg });
  for (const a of actual) byDay.get(a.day) && (byDay.get(a.day)!.actual = a.full);
  for (const p of projection) byDay.get(p.day) && (byDay.get(p.day)!.proj = p.full);
  const hover = [...byDay.values()];

  return (
    <PlotFigure
      deps={[actual, projection, range]}
      ariaLabel={`EU gas storage, % full. Latest actual ${last ? last.full.toFixed(1) : 'n/a'}%. ${
        end ? `Projected ${end.full.toFixed(1)}% on 31 March.` : ''
      } Range and average of winters ${rangeLabel}.`}
      render={(width) =>
        Plot.plot({
          width,
          height: width < 520 ? 300 : 380,
          marginLeft: 40,
          marginRight: width < 520 ? 44 : 64,
          marginTop: 30,
          style: PLOT_STYLE,
          x: { type: 'utc', label: null, ticks: width < 520 ? 3 : 6, tickFormat: (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) },
          y: { domain: [0, 100], label: '% full', labelAnchor: 'top', grid: true, ticks: 5 },
          marks: [
            Plot.gridY({ stroke: COLORS.grid, strokeOpacity: 1 }),
            Plot.areaY(range.filter((r) => Number.isFinite(r.min)), {
              x: (r: RangePoint) => toDate(r.day),
              y1: 'min',
              y2: 'max',
              fill: BAND,
              fillOpacity: BAND_OPACITY,
            }),
            Plot.lineY(range.filter((r) => Number.isFinite(r.avg)), {
              x: (r: RangePoint) => toDate(r.day),
              y: 'avg',
              stroke: AVG,
              strokeWidth: 1.5,
              strokeOpacity: 0.75,
            }),
            Plot.lineY(proj, { x: (p) => toDate(p.day), y: 'full', stroke: COLORS.accent, strokeWidth: 2, strokeDasharray: '5,4' }),
            Plot.lineY(actual, { x: (p) => toDate(p.day), y: 'full', stroke: COLORS.accent, strokeWidth: 2.5 }),
            ...(end
              ? [
                  Plot.dot([end], { x: (p: PathPoint) => toDate(p.day), y: 'full', r: 5, fill: COLORS.brass, stroke: COLORS.navy, strokeWidth: 1.5 }),
                  Plot.text([end], {
                    x: (p: PathPoint) => toDate(p.day),
                    y: 'full',
                    text: (p: PathPoint) => `${p.full.toFixed(1)}%`,
                    dx: 8,
                    textAnchor: 'start',
                    fill: COLORS.ink,
                    fontWeight: 600,
                  }),
                ]
              : []),
            Plot.ruleX(hover, Plot.pointerX({ x: (h) => toDate(h.day), stroke: COLORS.muted, strokeOpacity: 0.5 })),
            Plot.tip(
              hover,
              Plot.pointerX({
                x: (h) => toDate(h.day),
                y: (h) => h.actual ?? h.proj ?? h.avg,
                title: (h) =>
                  [
                    fmtDay(h.day),
                    h.actual !== undefined ? `This winter ${h.actual.toFixed(1)}%` : null,
                    h.proj !== undefined ? `Projection ${h.proj.toFixed(1)}%` : null,
                    Number.isFinite(h.avg) ? `${rangeLabel} average ${h.avg.toFixed(1)}%` : null,
                    Number.isFinite(h.min) ? `Range ${h.min.toFixed(1)}% to ${h.max.toFixed(1)}%` : null,
                  ]
                    .filter(Boolean)
                    .join('\n'),
              }),
            ),
          ],
        })
      }
    />
  );
}

export function StorageLegend({ rangeLabel, showProjection }: { rangeLabel: string; showProjection: boolean }) {
  return (
    <ul class="legend" aria-label="Chart legend">
      <li>
        <svg width="22" height="10" aria-hidden="true"><line x1="0" y1="5" x2="22" y2="5" stroke={COLORS.accent} stroke-width="2.5" /></svg>
        This winter
      </li>
      {showProjection && (
        <li>
          <svg width="22" height="10" aria-hidden="true"><line x1="0" y1="5" x2="22" y2="5" stroke={COLORS.accent} stroke-width="2" stroke-dasharray="5,4" /></svg>
          Projection
        </li>
      )}
      <li>
        <svg width="22" height="10" aria-hidden="true"><line x1="0" y1="5" x2="22" y2="5" stroke={AVG} stroke-width="1.5" stroke-opacity="0.75" /></svg>
        Average {rangeLabel}
      </li>
      <li>
        <svg width="16" height="10" aria-hidden="true"><rect width="16" height="10" rx="2" fill={BAND} fill-opacity={BAND_OPACITY} /></svg>
        Range {rangeLabel}
      </li>
    </ul>
  );
}
