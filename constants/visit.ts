// constants/visit.ts
export type VisitRecord = {
  id: string;
  placeId?: string;
  placeName: string;

  lat: number;
  lng: number;

  note: string;

  visitDates: string[];
  visitCount: number;

  createdAt: string;
  updatedAt: string;

  normalizedName: string;
};

export const VISITS_STORAGE_KEY = "MY_MAP_APP_VISITS_V1";

export function normalizePlaceName(name: string) {
  return (name || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[(){}\[\]'"`.,!?:;~@#$%^&*_+=<>\\/|-]/g, "");
}

// Haversine (m)
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * (sinDLng * sinDLng);

  return 2 * R * Math.asin(Math.sqrt(h));
}

// Levenshtein distance
function levenshtein(a: string, b: string) {
  const s = a ?? "";
  const t = b ?? "";
  const m = s.length;
  const n = t.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export function nameSimilarity(a: string, b: string) {
  const x = normalizePlaceName(a);
  const y = normalizePlaceName(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  const d = levenshtein(x, y);
  const maxLen = Math.max(x.length, y.length);
  return maxLen === 0 ? 1 : 1 - d / maxLen;
}

export function isSamePlace(
  existing: VisitRecord,
  candidate: { lat: number; lng: number; placeId?: string; placeName: string },
  radiusM = 50,
  simThreshold = 0.86
) {
  if (existing.placeId && candidate.placeId && existing.placeId === candidate.placeId) return true;

  const dist = distanceMeters(existing.lat, existing.lng, candidate.lat, candidate.lng);
  if (dist > radiusM) return false;

  const sim = nameSimilarity(existing.placeName, candidate.placeName);
  return sim >= simThreshold;
}
