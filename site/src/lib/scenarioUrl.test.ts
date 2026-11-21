import { describe, expect, it } from 'vitest';
import { applyDistances, decodeScenario, encodeScenario, scenarioFromDefaults } from './scenarioUrl';
import { defaultInputs, defaultRoutes } from './assumptions';
import { FIELDS } from './fields';

const defaults = scenarioFromDefaults(defaultInputs, defaultRoutes);

describe('scenario URL', () => {
  it('encodes nothing when the scenario equals the defaults', () => {
    expect(encodeScenario(defaults, defaults)).toBe('');
  });

  it('round-trips changed inputs and distances', () => {
    const s = {
      inputs: { ...defaults.inputs, jkm: 31.25, charterRate: 80000, boilOff: 0.1 },
      distances: { ...defaults.distances, 'asia-panama': 9500 },
    };
    const q = encodeScenario(s, defaults);
    expect(q).toContain('jkm=31.25');
    expect(q).toContain('cr=80000');
    expect(q).toContain('d_asia-panama=9500');
    expect(q).not.toContain('hh=');
    expect(decodeScenario(q, defaults)).toEqual(s);
    expect(decodeScenario('?' + q, defaults)).toEqual(s);
  });

  it('writes clean numbers without float noise', () => {
    const s = { ...defaults, inputs: { ...defaults.inputs, boilOff: 0.1 + 0.2 } };
    expect(encodeScenario(s, defaults)).toBe('bo=0.3');
  });

  it('ignores junk, unknown keys and empty values; clamps out-of-range values', () => {
    const d = decodeScenario('jkm=abc&zzz=5&hh=&cr=-100&sp=999&d_nwe=1&d_unknown=4000', defaults);
    expect(d.inputs.jkm).toBe(defaults.inputs.jkm);
    expect(d.inputs.henryHub).toBe(defaults.inputs.henryHub);
    expect(d.inputs.charterRate).toBe(0);
    expect(d.inputs.speed).toBe(25);
    expect(d.distances.nwe).toBe(500);
    expect(d.distances).not.toHaveProperty('unknown');
  });

  it('has a unique URL key per field', () => {
    const qs = FIELDS.map((f) => f.q);
    expect(new Set(qs).size).toBe(qs.length);
  });

  it('applies distances to routes', () => {
    const r = applyDistances(defaultRoutes, { nwe: 6000 });
    expect(r.find((x) => x.id === 'nwe')!.distanceNm).toBe(6000);
    expect(r.find((x) => x.id === 'asia-suez')!.distanceNm).toBe(14521);
  });

  it('defaults are within field bounds', () => {
    for (const f of FIELDS) {
      expect(defaultInputs[f.key]).toBeGreaterThanOrEqual(f.min);
      expect(defaultInputs[f.key]).toBeLessThanOrEqual(f.max);
    }
  });
});
