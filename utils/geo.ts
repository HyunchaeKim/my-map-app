// utils/geo.ts
type LngLat = [number, number];

function pointInRing(point: LngLat, ring: LngLat[]) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

function bboxOfRing(ring: LngLat[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function bboxContains(b: { minX: number; minY: number; maxX: number; maxY: number }, p: LngLat) {
  return p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minY && p[1] <= b.maxY;
}

export function featureContainsPoint(feature: any, lng: number, lat: number) {
  const geom = feature?.geometry;
  if (!geom) return false;

  const point: LngLat = [lng, lat];

  if (geom.type === "Polygon") {
    const rings: LngLat[][] = geom.coordinates;
    if (!rings?.length) return false;

    const outer = rings[0];
    const b = bboxOfRing(outer);
    if (!bboxContains(b, point)) return false;

    if (!pointInRing(point, outer)) return false;

    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(point, rings[i])) return false;
    }
    return true;
  }

  if (geom.type === "MultiPolygon") {
    const polys: LngLat[][][] = geom.coordinates;
    for (const rings of polys) {
      const outer = rings[0];
      const b = bboxOfRing(outer);
      if (!bboxContains(b, point)) continue;

      if (!pointInRing(point, outer)) continue;

      let inHole = false;
      for (let i = 1; i < rings.length; i++) {
        if (pointInRing(point, rings[i])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
    return false;
  }

  return false;
}
