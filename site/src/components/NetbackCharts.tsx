/** The two netback charts. Chart code only; all numbers come from lib/netback. */
import * as Plot from '@observablehq/plot';
import { fmtUsd } from '../lib/format';
import type { NetbackResult, SensitivityPoint } from '../lib/netback';
import type { DisplayRoute } from '../lib/netbackText';
import PlotFigure from './PlotFigure';

export const COLORS = {
  accent: '#0b5e63',
  rest: '#a9b4bc',
  ink: '#1a1f24',
  muted: '#5b6670',
  grid: '#e6ebef',
};

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function NetbackBars({ res }: { res: NetbackResult }) {
  const data = res.routes.map((r) => ({
    label: (r.route as DisplayRoute).shortLabel,
    netback: r.netback,
    best: r.route.id === res.best.route.id,
    shipping: r.shippingCost,
    boilOff: r.boilOffCost,
  }));
  const xMax = Math.max(...data.map((d) => d.netback), 1) * 1.02;
  return (
    <PlotFigure
      deps={[res]}
      ariaLabel={`FOB netback by route. ${data.map((d) => `${d.label} ${fmtUsd(d.netback)}`).join(', ')} per MMBtu.`}
      render={(width) =>
        Plot.plot({
          width,
          height: 44 * data.length + 36,
          marginLeft: 112,
          marginRight: 92,
          style: { fontFamily: FONT, fontSize: '13px', color: COLORS.ink },
          x: { domain: [0, xMax], label: null, grid: true, ticks: width < 520 ? 3 : 5, tickFormat: (d: number) => `$${d}` },
          y: { label: null, domain: data.map((d) => d.label), tickSize: 0, padding: 0.35 },
          marks: [
            Plot.gridX({ stroke: COLORS.grid, strokeOpacity: 1 }),
            Plot.barX(data, {
              x: 'netback',
              y: 'label',
              fill: (d) => (d.best ? COLORS.accent : COLORS.rest),
              rx: 4,
            }),
            Plot.ruleX([0], { stroke: COLORS.muted }),
            ...[true, false].map((isBest) =>
              Plot.text(
                data.filter((d) => d.best === isBest),
                {
                  x: 'netback',
                  y: 'label',
                  text: (d) => `${fmtUsd(d.netback)}${isBest ? '  best' : ''}`,
                  textAnchor: 'start',
                  dx: 6,
                  fill: COLORS.ink,
                  fontWeight: isBest ? 600 : 400,
                },
              ),
            ),
            Plot.tip(
              data,
              Plot.pointerY({
                x: 'netback',
                y: 'label',
                title: (d) =>
                  `${d.label}\nNetback ${fmtUsd(d.netback)}/MMBtu\nShipping ${fmtUsd(d.shipping)}/MMBtu\nBoil-off ${fmtUsd(d.boilOff)}/MMBtu`,
              }),
            ),
          ],
        })
      }
    />
  );
}

export function ArbSensitivity({
  points,
  currentCharter,
  breakeven,
}: {
  points: SensitivityPoint[];
  currentCharter: number;
  breakeven: number | null;
}) {
  const ys = points.map((p) => p.arb);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(0, ...ys);
  const pad = (yMax - yMin) * 0.12 || 0.5;
  return (
    <PlotFigure
      deps={[points, currentCharter, breakeven]}
      ariaLabel={`Europe to Asia arb against charter rate. ${
        breakeven === null ? 'The arb does not change sign in this range.' : `The arb is zero at ${fmtUsd(breakeven, 0)}/day.`
      }`}
      render={(width) =>
        Plot.plot({
          width,
          height: 300,
          marginLeft: 52,
          marginRight: 20,
          marginTop: 28,
          marginBottom: 46,
          style: { fontFamily: FONT, fontSize: '13px', color: COLORS.ink },
          x: {
            label: 'Charter rate ($/day)',
            labelAnchor: 'center',
            labelArrow: 'none',
            labelOffset: 40,
            tickFormat: (d: number) => `${d / 1000}k`,
            ticks: width < 520 ? 4 : 6,
          },
          y: { label: 'Arb, best Asia minus Europe ($/MMBtu)', labelAnchor: 'top', domain: [yMin - pad, yMax + pad], grid: true, ticks: 6 },
          marks: [
            Plot.gridY({ stroke: COLORS.grid, strokeOpacity: 1 }),
            Plot.ruleY([0], { stroke: COLORS.muted }),
            Plot.ruleX([currentCharter], { stroke: COLORS.muted, strokeWidth: 1 }),
            // Pinned to the top of the frame so it never meets the breakeven label on the zero line.
            Plot.text([currentCharter], {
              x: (d: number) => d,
              frameAnchor: 'top',
              text: () => `Current ${fmtUsd(currentCharter, 0)}/day`,
              dy: 8,
              textAnchor: currentCharter > points[points.length - 1].charterRate * 0.7 ? 'end' : 'start',
              dx: currentCharter > points[points.length - 1].charterRate * 0.7 ? -6 : 6,
              fill: COLORS.muted,
            }),
            Plot.lineY(points, { x: 'charterRate', y: 'arb', stroke: COLORS.accent, strokeWidth: 2 }),
            ...(breakeven === null
              ? []
              : [
                  Plot.dot([{ x: breakeven, y: 0 }], { x: 'x', y: 'y', r: 5, fill: COLORS.accent, stroke: '#fff', strokeWidth: 2 }),
                  Plot.text([{ x: breakeven, y: 0 }], {
                    x: 'x',
                    y: 'y',
                    // The line falls left to right: below-left and above-right of the crossing are clear.
                    text: () => `Breakeven ${fmtUsd(Math.round(breakeven / 100) * 100, 0)}/day`,
                    textAnchor: breakeven > points[points.length - 1].charterRate * 0.35 ? 'end' : 'start',
                    dx: breakeven > points[points.length - 1].charterRate * 0.35 ? -10 : 10,
                    dy: breakeven > points[points.length - 1].charterRate * 0.35 ? 14 : -12,
                    fill: COLORS.ink,
                    fontWeight: 600,
                  }),
                ]),
            Plot.ruleX(points, Plot.pointerX({ x: 'charterRate', stroke: COLORS.muted, strokeOpacity: 0.5 })),
            Plot.dot(points, Plot.pointerX({ x: 'charterRate', y: 'arb', r: 4, fill: COLORS.accent, stroke: '#fff', strokeWidth: 2 })),
            Plot.tip(
              points,
              Plot.pointerX({
                x: 'charterRate',
                y: 'arb',
                title: (p: SensitivityPoint) => `Charter ${fmtUsd(p.charterRate, 0)}/day\nArb ${fmtUsd(p.arb)}/MMBtu`,
              }),
            ),
          ],
        })
      }
    />
  );
}
