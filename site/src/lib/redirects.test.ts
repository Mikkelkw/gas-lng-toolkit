import { describe, expect, it } from 'vitest';
import { isOffCanonicalHost, legacyPath, redirectTarget } from './redirects';

const t = (u: string) => redirectTarget(new URL(u));

describe('redirects (SPEC 11.3)', () => {
  it('pages.dev and www go to the apex, keeping path and query string', () => {
    expect(t('https://gas-lng-toolkit.pages.dev/')).toBe('https://lngtoolkit.com/');
    expect(t('https://gas-lng-toolkit.pages.dev/lng-netback-calculator/?jkm=30&ttf=40')).toBe(
      'https://lngtoolkit.com/lng-netback-calculator/?jkm=30&ttf=40',
    );
    expect(t('https://www.lngtoolkit.com/methodology/#data')).toBe('https://lngtoolkit.com/methodology/');
    expect(t('https://abc123.gas-lng-toolkit.pages.dev/data/storage.json')).toBe('https://lngtoolkit.com/data/storage.json');
    expect(t('https://WWW.LNGTOOLKIT.COM/about/')).toBe('https://lngtoolkit.com/about/');
  });

  it('the canonical host is served as is', () => {
    expect(t('https://lngtoolkit.com/')).toBeNull();
    expect(t('https://lngtoolkit.com/eu-gas-storage-forecast/?x=1')).toBeNull();
    expect(t('http://localhost:4321/about/')).toBeNull();
  });

  it('old tool paths move in one hop, on any host', () => {
    expect(t('https://lngtoolkit.com/netback')).toBe('https://lngtoolkit.com/lng-netback-calculator/');
    expect(t('https://lngtoolkit.com/storage/')).toBe('https://lngtoolkit.com/eu-gas-storage-forecast/');
    expect(t('https://gas-lng-toolkit.pages.dev/netback?jkm=30')).toBe('https://lngtoolkit.com/lng-netback-calculator/?jkm=30');
    expect(t('http://localhost:4321/storage')).toBe('http://localhost:4321/eu-gas-storage-forecast/');
  });

  it('host and path helpers', () => {
    expect(isOffCanonicalHost('gas-lng-toolkit.pages.dev')).toBe(true);
    expect(isOffCanonicalHost('lngtoolkit.com')).toBe(false);
    expect(isOffCanonicalHost('notlngtoolkit.com')).toBe(false);
    expect(legacyPath('/netback/')).toBe('/lng-netback-calculator/');
    expect(legacyPath('/netbacks')).toBeNull();
    expect(legacyPath('/')).toBeNull();
  });
});
