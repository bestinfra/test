/**
 * Utilities to spread overlapping map marker positions so multiple markers
 * at the same or nearby locations remain visible.
 */

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

const METERS_PER_DEG_LAT = 111320;
const RAD = Math.PI / 180;

/**
 * Haversine distance between two points in meters.
 */
export function distanceMeters(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRad = (v: number) => v * RAD;
  const R = 6371e3;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);
  const x =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
}

/**
 * Move a point by a given distance in a given bearing.
 * @param pos - { lat, lng }
 * @param bearingDegrees - 0 = North, 90 = East
 * @param distanceMeters - distance to move
 */
export function movePointMeters(
  pos: LatLngLiteral,
  bearingDegrees: number,
  distanceMeters: number
): LatLngLiteral {
  const dlat =
    (distanceMeters / METERS_PER_DEG_LAT) * Math.cos(bearingDegrees * RAD);
  const dlng =
    (distanceMeters / (METERS_PER_DEG_LAT * Math.cos(pos.lat * RAD))) *
    Math.sin(bearingDegrees * RAD);
  return { lat: pos.lat + dlat, lng: pos.lng + dlng };
}

/** Union-Find for clustering. */
function find(parent: number[], i: number): number {
  if (parent[i] !== i) parent[i] = find(parent, parent[i]);
  return parent[i];
}
function union(parent: number[], i: number, j: number): void {
  const ri = find(parent, i);
  const rj = find(parent, j);
  if (ri !== rj) parent[ri] = rj;
}

export interface SpreadOptions {
  /** Points closer than this (meters) are considered overlapping. Default 10. */
  toleranceMeters?: number;
  /** Radius of the circle (meters) on which overlapping points are placed. Default 18. */
  spreadRadiusMeters?: number;
}

/**
 * Spread overlapping positions so they are placed on a circle around the cluster
 * centroid when they are within tolerance. Preserves order; single points and
 * non-overlapping points are unchanged.
 *
 * @param positions - array of { lat, lng }
 * @param options - toleranceMeters (default 10), spreadRadiusMeters (default 18)
 * @returns new array of positions in the same order, with overlapping ones spread
 */
export function spreadOverlappingPositions(
  positions: LatLngLiteral[],
  options?: SpreadOptions
): LatLngLiteral[] {
  const tolerance = options?.toleranceMeters ?? 10;
  const radius = options?.spreadRadiusMeters ?? 18;

  if (positions.length === 0) return [];

  // 1) Union-Find clustering
  const n = positions.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (distanceMeters(positions[i], positions[j]) <= tolerance) {
        union(parent, i, j);
      }
    }
  }

  // 2) Build clusters: root -> indices
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(parent, i);
    if (!clusters.has(r)) clusters.set(r, []);
    clusters.get(r)!.push(i);
  }

  // 3) For each cluster: centroid and circle placement
  const out: LatLngLiteral[] = new Array(n);
  for (const indices of clusters.values()) {
    if (indices.length === 1) {
      out[indices[0]] = { ...positions[indices[0]] };
      continue;
    }
    const centroid: LatLngLiteral = {
      lat: indices.reduce((s, i) => s + positions[i].lat, 0) / indices.length,
      lng: indices.reduce((s, i) => s + positions[i].lng, 0) / indices.length,
    };
    const K = indices.length;
    indices.forEach((idx, k) => {
      const angleDeg = (360 * k) / K; // 0, 360/K, 720/K, ...
      out[idx] = movePointMeters(centroid, angleDeg, radius);
    });
  }

  return out;
}
