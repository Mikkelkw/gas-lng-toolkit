/** Netback calculator island. UI only: every number comes from lib/netback. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { AssumptionItem, InputKey } from '../lib/assumptions';
import { DISTANCE_BOUNDS, FIELDS, GROUP_LABELS, clampField, type FieldDef } from '../lib/fields';
import { fmt, fmtUsd } from '../lib/format';
import { breakevenCharter, charterSensitivity, computeNetbacks, type NetbackInputs, type NetbackResult } from '../lib/netback';
import { breakevenSentence, headline, marginWarning, type DisplayRoute } from '../lib/netbackText';
import { applyDistances, decodeScenario, encodeScenario, scenarioFromDefaults, type Scenario } from '../lib/scenarioUrl';
import { ArbSensitivity, NetbackBars } from './NetbackCharts';

interface Props {
  items: Record<InputKey, AssumptionItem>;
  routes: DisplayRoute[];
}

/** Inputs whose defaults carry an "as of" date on screen (market prices). */
const DATED: InputKey[] = ['henryHub', 'ttf', 'jkm', 'eurusd', 'charterRate'];

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function NumberField(props: {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  note?: string;
  title?: string;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(props.value));
  // Keep the text in sync when the value changes from outside (reset, URL).
  useEffect(() => {
    if (Number(text) !== props.value) setText(String(props.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  const commit = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') return;
    const v = clampField(Number(raw), props.min, props.max);
    if (v !== null && v === Number(raw)) props.onChange(v);
  };
  const invalid = text.trim() === '' || !Number.isFinite(Number(text)) || Number(text) < props.min || Number(text) > props.max;
  return (
    <div class="field">
      <label for={props.id}>
        {props.label} <span class="unit">({props.unit})</span>
      </label>
      <input
        id={props.id}
        type="number"
        inputMode="decimal"
        value={text}
        min={props.min}
        max={props.max}
        step={props.step}
        aria-invalid={invalid}
        aria-describedby={props.note ? `${props.id}-note` : undefined}
        title={props.title}
        onInput={(e) => commit((e.target as HTMLInputElement).value)}
        onBlur={() => invalid && setText(String(props.value))}
      />
      {invalid && <span class="field-error">Enter a value from {props.min} to {props.max}.</span>}
      {props.note && (
        <span class="note" id={`${props.id}-note`}>
          {props.note}
        </span>
      )}
    </div>
  );
}

function ResultsTable({ res }: { res: NetbackResult }) {
  return (
    <div class="table-wrap" role="region" aria-label="Netback by route" tabIndex={0}>
      <table class="results">
        <caption class="sr-only">Netback by route, $/MMBtu unless stated</caption>
        <thead>
          <tr>
            <th scope="col">Route</th>
            <th scope="col" class="num">Laden voyage (days)</th>
            <th scope="col" class="num">Shipping ($/MMBtu)</th>
            <th scope="col" class="num">Boil-off ($/MMBtu)</th>
            <th scope="col" class="num">FOB netback ($/MMBtu)</th>
            <th scope="col" class="num">Margin vs cost of supply ($/MMBtu)</th>
          </tr>
        </thead>
        <tbody>
          {res.routes.map((r) => (
            <tr key={r.route.id} class={r.route.id === res.best.route.id ? 'best' : undefined}>
              <th scope="row">
                <span class="label-long">{r.route.label}</span>
                <span class="label-short">{(r.route as DisplayRoute).shortLabel}</span>
              </th>
              <td class="num">{fmt(r.ladenDays, 1)}</td>
              <td class="num">{fmt(r.shippingCost)}</td>
              <td class="num">{fmt(r.boilOffCost)}</td>
              <td class="num strong">{fmt(r.netback)}</td>
              <td class={`num${r.margin < 0 ? ' neg' : ''}`}>{fmt(r.margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function NetbackTool({ items, routes }: Props) {
  const defaultInputs = useMemo(
    () => Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.value])) as unknown as NetbackInputs,
    [items],
  );
  const defaults = useMemo(() => scenarioFromDefaults(defaultInputs, routes), [defaultInputs, routes]);
  const [scenario, setScenario] = useState<Scenario>(defaults);
  const [status, setStatus] = useState('');

  // Load a shared scenario from the URL once, on the client.
  useEffect(() => {
    if (window.location.search) setScenario(decodeScenario(window.location.search, defaults));
  }, [defaults]);

  // Keep the URL in step with the scenario so the address bar is always shareable.
  useEffect(() => {
    const q = encodeScenario(scenario, defaults);
    const url = `${window.location.pathname}${q ? `?${q}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', url);
  }, [scenario, defaults]);

  const liveRoutes = useMemo(() => applyDistances(routes, scenario.distances) as DisplayRoute[], [routes, scenario.distances]);

  const calc = useMemo(() => {
    try {
      const res = computeNetbacks(scenario.inputs, liveRoutes);
      const hi = Math.max(150_000, Math.ceil((scenario.inputs.charterRate * 2) / 10_000) * 10_000);
      const points = charterSensitivity(scenario.inputs, liveRoutes, 0, hi, 60);
      const be = breakevenCharter(scenario.inputs, liveRoutes, 0, hi);
      return { res, points, be, error: '' };
    } catch (e) {
      return { res: null, points: [], be: null, error: (e as Error).message };
    }
  }, [scenario.inputs, liveRoutes]);

  const setInput = (k: InputKey, v: number) => setScenario((s) => ({ ...s, inputs: { ...s.inputs, [k]: v } }));
  const setDistance = (id: string, v: number) => setScenario((s) => ({ ...s, distances: { ...s.distances, [id]: v } }));

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied. It opens this scenario.');
    } catch {
      setStatus(`Copy this link: ${url}`);
    }
  };
  const reset = () => {
    setScenario(defaults);
    setStatus('Inputs reset to the documented defaults.');
  };

  const changed = encodeScenario(scenario, defaults) !== '';
  const groups = Object.keys(GROUP_LABELS) as FieldDef['group'][];
  const { res } = calc;

  return (
    <div class="tool">
      <section class="tool-results" aria-labelledby="result-heading">
        <h2 id="result-heading" class="headline" aria-live="polite">
          {res ? headline(res) : 'Check the inputs'}
        </h2>
        {res ? (
          <>
            <p class="lede">
              Arb (best Asia minus Europe): <strong>{fmtUsd(res.arb)}/MMBtu</strong>. {breakevenSentence(res, scenario.inputs.jkm)}{' '}
              TTF converts to {fmtUsd(res.ttfUsd)}/MMBtu. Cost of supply is {fmtUsd(res.costOfSupply)}/MMBtu.
            </p>
            {marginWarning(res) && <p class="warning">{marginWarning(res)}</p>}
            <ResultsTable res={res} />

            <figure class="chart">
              <figcaption>
                <strong>FOB netback by route</strong>
                <span class="muted"> ($/MMBtu, US Gulf Coast)</span>
              </figcaption>
              <NetbackBars res={res} />
              <p class="chart-source">Source: calculation from the inputs above. Henry Hub: EIA. EUR/USD: ECB.</p>
            </figure>

            <figure class="chart">
              <figcaption>
                <strong>Arb sensitivity to the charter rate</strong>
                <span class="muted"> (best Asia minus Europe, $/MMBtu). Above zero, Asia pays more.</span>
              </figcaption>
              <ArbSensitivity points={calc.points} currentCharter={scenario.inputs.charterRate} breakeven={calc.be} />
              <p class="chart-note">
                {calc.be === null
                  ? `The arb does not change sign between $0 and ${fmtUsd(calc.points[calc.points.length - 1].charterRate, 0)}/day.`
                  : `The arb is zero at a charter rate of ${fmtUsd(Math.round(calc.be / 100) * 100, 0)}/day.`}
              </p>
              <p class="chart-source">Source: calculation from the inputs above. Henry Hub: EIA. EUR/USD: ECB.</p>
            </figure>
          </>
        ) : (
          <p class="warning">{calc.error}</p>
        )}
      </section>

      <section class="tool-inputs" aria-labelledby="inputs-heading">
        <div class="inputs-head">
          <h2 id="inputs-heading">Inputs</h2>
          <div class="actions">
            <button type="button" class="btn primary" onClick={copyLink}>
              Copy link
            </button>
            <button type="button" class="btn" onClick={reset} disabled={!changed}>
              Reset
            </button>
          </div>
        </div>
        <p class="status" role="status">
          {status}
        </p>
        {groups.map((g) => (
          <fieldset key={g}>
            <legend>{GROUP_LABELS[g]}</legend>
            <div class="fields">
              {FIELDS.filter((f) => f.group === g).map((f) => (
                <NumberField
                  key={f.key}
                  id={`in-${f.q}`}
                  label={f.label}
                  unit={f.unit}
                  value={scenario.inputs[f.key]}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  title={items[f.key].source}
                  note={
                    DATED.includes(f.key)
                      ? `Default ${items[f.key].value.toLocaleString('en-GB')} as of ${fmtDate(items[f.key].asOf)}${
                          f.key === 'ttf' || f.key === 'jkm' ? ', entered manually' : ''
                        }`
                      : undefined
                  }
                  onChange={(v) => setInput(f.key, v)}
                />
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend>Distances, one way (nautical miles)</legend>
          <div class="fields">
            {routes.map((r) => (
              <NumberField
                key={r.id}
                id={`in-d-${r.id}`}
                label={r.shortLabel}
                unit="nm"
                value={scenario.distances[r.id]}
                min={DISTANCE_BOUNDS.min}
                max={DISTANCE_BOUNDS.max}
                step={DISTANCE_BOUNDS.step}
                title={(r as DisplayRoute & { source?: string }).source}
                onChange={(v) => setDistance(r.id, v)}
              />
            ))}
          </div>
        </fieldset>
      </section>
    </div>
  );
}
