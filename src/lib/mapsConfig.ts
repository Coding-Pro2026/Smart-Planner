/**
 * Optional Google Maps JavaScript API key — supplied by the USER (bring-your-own-key).
 * Without one, the app shows an OpenStreetMap map (no key, no Google ToS exposure).
 * A Maps key is a public, referrer-restricted browser key by design; still kept out of the autosave.
 */
const KEY = 'plangenie:v2:maps-key';

export function getMapsKey(): string {
  try {
    const stored = window.localStorage.getItem(KEY)?.trim() ?? '';
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  const env = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
  return env.length >= 20 && !/YOUR_|PLACEHOLDER/i.test(env) ? env : '';
}

export function setMapsKey(value: string): void {
  try {
    const v = value.trim();
    if (v && /^[A-Za-z0-9_-]{20,80}$/.test(v)) window.localStorage.setItem(KEY, v);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isValidMapsKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,80}$/.test(value.trim());
}

/** OpenStreetMap embed (official, keyless). bbox order: west,south,east,north. */
export function osmEmbedUrl(lat: number, lng: number, span = 0.012): string {
  const bbox = [lng - span, lat - span * 0.6, lng + span, lat + span * 0.6].map((n) => n.toFixed(5)).join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function osmViewUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=16/${lat.toFixed(5)}/${lng.toFixed(5)}`;
}
