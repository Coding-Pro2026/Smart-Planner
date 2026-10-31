/**
 * OpenStreetMap geocoding + hotel discovery.
 * Complies with the Nominatim Usage Policy: identifying User-Agent, max 1 request/second
 * (serialised queue), results cached, no autocomplete / bulk use. Data © OpenStreetMap contributors (ODbL).
 */

const CONTACT = process.env.NOMINATIM_CONTACT || process.env.APP_URL || 'https://github.com/Coding-Pro2026/Planner-AI';
const UA = `PlanGenie/1.0 (event planner; contact: ${CONTACT})`;

interface CacheEntry<T> {
  value: T;
  expires: number;
}

class TtlCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  constructor(private max: number, private ttlMs: number) {}
  get(k: string): T | undefined {
    const e = this.map.get(k);
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      this.map.delete(k);
      return undefined;
    }
    return e.value;
  }
  set(k: string, v: T) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string);
    this.map.set(k, { value: v, expires: Date.now() + this.ttlMs });
  }
}

export interface GeoResult {
  lat: number;
  lng: number;
  displayName: string;
  bbox?: [number, number, number, number]; // south, north, west, east
}

export interface OsmHotel {
  id: string;
  name: string;
  address: string;
  website?: string;
  stars?: number;
  lat: number;
  lng: number;
  distanceMiles: number;
}

const geoCache = new TtlCache<GeoResult | null>(500, 24 * 3600_000);
const hotelCache = new TtlCache<OsmHotel[]>(200, 6 * 3600_000);

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
/** Serialises Nominatim calls and enforces >= 1.1 s spacing. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCall + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function geocode(query: string): Promise<GeoResult | null> {
  const q = query.trim().slice(0, 200);
  if (q.length < 2) return null;
  const key = q.toLowerCase();
  const cached = geoCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const result = await throttled(async () => {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      const data = (await res.json()) as any[];
      const top = Array.isArray(data) ? data[0] : null;
      if (!top || !Number.isFinite(Number(top.lat)) || !Number.isFinite(Number(top.lon))) return null;
      const bb = Array.isArray(top.boundingbox) ? top.boundingbox.map(Number) : null;
      return {
        lat: Number(top.lat),
        lng: Number(top.lon),
        displayName: String(top.display_name ?? q).slice(0, 200),
        bbox: bb && bb.length === 4 && bb.every(Number.isFinite) ? (bb as [number, number, number, number]) : undefined,
      } satisfies GeoResult;
    });
    geoCache.set(key, result);
    return result;
  } catch {
    return null; // transient failure: not cached
  }
}

export async function findHotelsNear(lat: number, lng: number, limit = 8): Promise<OsmHotel[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = hotelCache.get(key);
  if (cached) return cached;
  const q = `[out:json][timeout:8];(node["tourism"="hotel"](around:8000,${lat},${lng});way["tourism"="hotel"](around:8000,${lat},${lng}););out center tags 40;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: `data=${encodeURIComponent(q)}`,
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const out: OsmHotel[] = [];
    for (const el of Array.isArray(json?.elements) ? json.elements : []) {
      const name = el?.tags?.name;
      const hLat = Number(el.lat ?? el.center?.lat);
      const hLng = Number(el.lon ?? el.center?.lon);
      if (typeof name !== 'string' || !Number.isFinite(hLat) || !Number.isFinite(hLng)) continue;
      const t = el.tags;
      const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
      const address = [street, t['addr:city']].filter(Boolean).join(', ');
      const stars = Number(t.stars);
      out.push({
        id: `osm_${el.type}_${el.id}`,
        name: name.slice(0, 120),
        address: address.slice(0, 160),
        website: t.website || t['contact:website'] || undefined,
        stars: Number.isFinite(stars) && stars >= 1 && stars <= 5 ? stars : undefined,
        lat: hLat,
        lng: hLng,
        distanceMiles: Math.round(haversineMiles(lat, lng, hLat, hLng) * 10) / 10,
      });
    }
    const result = out.sort((a, b) => a.distanceMiles - b.distanceMiles).slice(0, limit);
    hotelCache.set(key, result);
    return result;
  } catch {
    return [];
  }
}
