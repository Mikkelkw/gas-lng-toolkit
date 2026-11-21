/** EU storage winter stress test island. UI only: numbers come from lib/storage. */
import { useMemo, useState } from 'preact/hooks';
import {
  DELIVERABILITY_NOTE,
  DELIVERABILITY_PCT,
  addDays,
  daysBetween,
  inDeliverabilityZone,
  likelyRange,
  project,
  storageHeadline,
  uncertaintyBand,
  type PathPoint,
  type Scenario,
} from '../lib/storage';
import type { StoragePayload } from '../lib/storagePayload';
import StorageChart, { StorageLegend } from './StorageChart';

const NORMAL: Scenario = { tempDelta: 0, lngPct: 0, disruptionTwh: 0, disruptionStart: null, disruptionDays: null, demandResponsePct: 0 };

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function signed(v: number, unit: string, decimals = 1) {
  const s = Math.abs(v).toFixed(decimals);
  return v > 0 ? `+${s}${unit}` : v < 0 ? `−${s}${unit}` : `0${unit}`;
}

function Slider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint: string;
  onChange: (v: number) => void;
}) {
  return (
    <div class="slider">
      <div class="slider-head">
        <label for={props.id}>{props.label}</label>
        <output for={props.id}>{props.display}</output>
      </div>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        aria-valuetext={props.display}
        onInput={(e) => props.onChange(Number((e.target as HTMLInputElement).value))}
      />
      <div class="slider-scale" aria-hidden="true">
        <span>{props.min}</span>
        <span>{props.max}</span>
      </div>
      <span class="note">{props.hint}</span>
    </div>
  );
}

export default function StorageTool({ data }: { data: StoragePayload }) {
  const [sc, setSc] = useState<Scenario>(NORMAL);
  const first = addDays(data.asOf, 1);
  const canProject = data.winter !== null && data.asOf < data.endDay;

  const run = (s: Scenario): PathPoint[] =>
    canProject
      ? project({
          startDay: data.asOf,
          startStorage: data.startStorage,
          wgv: data.wgv,
          endDay: data.endDay,
          coef: data.coef,
          normals: data.normals,
          forecast: data.forecast,
          recentLng: data.recentLng,
          dailyDemand: data.dailyDemand,
          scenario: s,
        })
      : [];

  const path = useMemo(() => run(sc), [sc, data]);
  const presetRows = useMemo(() => data.presets.map((p) => ({ p, end: run({ ...NORMAL, ...p }).at(-1) })), [data]);
  const end = path.at(-1);
  // Model uncertainty from the signed back-test errors, scaled to the days left. Same band for every scenario.
  const band = canProject ? uncertaintyBand(data.errors, daysBetween(data.asOf, data.endDay), data.noisePp) : { down: 0, up: 0 };
  const hasBand = band.down + band.up > 0;
  const rangeOf = (full: number) => likelyRange(full, band);
  const lowPresets = presetRows.filter(({ end: e }) => e && inDeliverabilityZone(e.full)).map(({ p }) => p.label);
  const activePreset = data.presets.find(
    (p) =>
      p.tempDelta === sc.tempDelta &&
      p.lngPct === sc.lngPct &&
      p.disruptionTwh === sc.disruptionTwh &&
      p.demandResponsePct === sc.demandResponsePct,
  )?.id;

  const set = (patch: Partial<Scenario>) => setSc((s) => ({ ...s, ...patch }));
  const rangeLabel = data.rangeWinters.length
    ? `${data.rangeWinters[0]} to ${data.rangeWinters[data.rangeWinters.length - 1]}`
    : 'previous winters';

  return (
    <div class="tool">
      <section class="tool-results" aria-labelledby="storage-result">
        <h2 id="storage-result" class="headline" aria-live="polite">
          {end ? storageHeadline(end, data.endDay, hasBand ? rangeOf(end.full) : undefined) : `Winter ${data.winterLabel}: projection resumes on 1 October`}
        </h2>
        <p class="lede">
          Data as of gas day <strong>{fmtDate(data.asOf)}</strong>: {data.actual.at(-1)?.full.toFixed(1)}% full (
          {Math.round(data.startStorage)} TWh of {Math.round(data.wgv)} TWh).
          {end && (
            <>
              {' '}
              Projected change to 31 March: {signed(end.storage - data.startStorage, ' TWh', 0)}.
            </>
          )}
        </p>
        {end && inDeliverabilityZone(end.full) && <p class="warning">{DELIVERABILITY_NOTE}</p>}
        {end && hasBand && (
          <p class="note-line">
            Likely range = projection −{band.down.toFixed(1)} to +{band.up.toFixed(1)} points, from the back-test errors for the same
            number of days to 31 March. {data.asymmetryNote} {data.biasNote}
          </p>
        )}
        {data.staleNote && <p class="warning">{data.staleNote}</p>}

        <figure class="chart">
          <figcaption>
            <strong>EU gas storage, % full</strong>
            <span class="muted"> ({fmtDate(`${data.winterLabel.slice(0, 4)}-10-01`)} to {fmtDate(data.endDay)})</span>
          </figcaption>
          <StorageLegend rangeLabel={rangeLabel} showProjection={path.length > 0} />
          <StorageChart actual={data.actual} projection={path} range={data.range} rangeLabel={rangeLabel} />
          <p class="chart-source">
            Source: GIE AGSI+ (storage), GIE ALSI (LNG send-out). Weather data:{' '}
            <a href="https://open-meteo.com/">Open-Meteo</a> (
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>). Projection: this site's model.
          </p>
        </figure>

        {canProject && (
          <>
            <h3 class="table-title">31 March under each preset</h3>
            <div class="table-wrap" role="region" aria-label="Projection under each preset" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Preset</th>
                    <th scope="col">Assumptions</th>
                    <th scope="col" class="num">31 Mar (% full)</th>
                    {hasBand && <th scope="col" class="num">Likely range (% full)</th>}
                    <th scope="col" class="num">31 Mar (TWh)</th>
                  </tr>
                </thead>
                <tbody>
                  {presetRows.map(({ p, end: e }) => (
                    <tr key={p.id} class={p.id === activePreset ? 'best' : undefined}>
                      <th scope="row">{p.label}</th>
                      <td>
                        {signed(p.tempDelta, ' °C')}, LNG {signed(p.lngPct, '%', 0)}
                      </td>
                      <td class={`num${e && inDeliverabilityZone(e.full) ? ' neg' : ''}`}>{e ? e.full.toFixed(1) : 'n/a'}</td>
                      {hasBand && (
                        <td class="num nowrap">
                          {e ? `${rangeOf(e.full).low.toFixed(1)} to ${rangeOf(e.full).high.toFixed(1)}` : 'n/a'}
                        </td>
                      )}
                      <td class="num">{e ? Math.round(e.storage) : 'n/a'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="chart-source">
              Weather: {data.forecastEnd ? `forecast to ${fmtDate(data.forecastEnd)}, then ` : ''}the average of winters{' '}
              {data.normalWinters[0]} to {data.normalWinters[data.normalWinters.length - 1]}, shifted by the scenario. LNG
              baseline: {data.recentLng.toFixed(2)} TWh/d, the last {data.recentLngDays} days' average.
              {hasBand && ` Likely range: projection −${band.down.toFixed(1)} to +${band.up.toFixed(1)} points, from the back-test. Not bias-corrected.`}
            </p>
            {lowPresets.length > 0 && (
              <p class="chart-source">
                At or below {DELIVERABILITY_PCT}% full on 31 March, in the deliverability constraint zone: {lowPresets.join(', ')}.
              </p>
            )}
          </>
        )}
      </section>

      {canProject && (
        <section class="tool-inputs" aria-labelledby="scenario-heading">
          <div class="inputs-head">
            <h2 id="scenario-heading">Scenario</h2>
            <button type="button" class="btn" onClick={() => setSc(NORMAL)} disabled={activePreset === 'normal' && !sc.disruptionTwh}>
              Reset
            </button>
          </div>
          <div class="presets" role="group" aria-label="Presets">
            {data.presets.map((p) => (
              <button
                key={p.id}
                type="button"
                class={`chip${p.id === activePreset ? ' on' : ''}`}
                aria-pressed={p.id === activePreset}
                onClick={() => setSc({ ...NORMAL, ...p })}
              >
                {p.label}
              </button>
            ))}
          </div>
          <fieldset>
            <legend>Weather and supply</legend>
            <Slider
              id="s-temp"
              label="Temperature vs normal"
              value={sc.tempDelta}
              min={-4}
              max={4}
              step={0.5}
              display={signed(sc.tempDelta, ' °C')}
              hint="Applies after the 16-day forecast."
              onChange={(v) => set({ tempDelta: v })}
            />
            <Slider
              id="s-lng"
              label="LNG send-out vs recent average"
              value={sc.lngPct}
              min={-30}
              max={30}
              step={5}
              display={signed(sc.lngPct, '%', 0)}
              hint={`Recent average ${data.recentLng.toFixed(2)} TWh/d.`}
              onChange={(v) => set({ lngPct: v })}
            />
            <Slider
              id="s-dr"
              label="Demand response"
              value={sc.demandResponsePct}
              min={0}
              max={15}
              step={1}
              display={`${sc.demandResponsePct}%`}
              hint={`Share of average EU demand (${data.dailyDemand.toFixed(1)} TWh/d) saved.`}
              onChange={(v) => set({ demandResponsePct: v })}
            />
          </fieldset>
          <fieldset>
            <legend>Supply disruption</legend>
            <Slider
              id="s-dis"
              label="Supply removed"
              value={sc.disruptionTwh}
              min={0}
              max={0.5}
              step={0.05}
              display={`${sc.disruptionTwh.toFixed(2)} TWh/d`}
              hint="For example, a pipeline outage."
              onChange={(v) => set({ disruptionTwh: v })}
            />
            <div class="fields">
              <div class="field">
                <label for="s-dis-start">Start date</label>
                <input
                  id="s-dis-start"
                  type="date"
                  min={first}
                  max={data.endDay}
                  value={sc.disruptionStart ?? first}
                  disabled={!sc.disruptionTwh}
                  onInput={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    set({ disruptionStart: v && v >= first && v <= data.endDay ? v : null });
                  }}
                />
              </div>
              <div class="field">
                <label for="s-dis-days">
                  Duration <span class="unit">(days, blank to 31 Mar)</span>
                </label>
                <input
                  id="s-dis-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={183}
                  value={sc.disruptionDays ?? ''}
                  disabled={!sc.disruptionTwh}
                  onInput={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    set({ disruptionDays: Number.isInteger(v) && v >= 1 && v <= 183 ? v : null });
                  }}
                />
              </div>
            </div>
          </fieldset>
        </section>
      )}
    </div>
  );
}
