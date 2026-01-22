import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import WebView from "react-native-webview";
import { loadDogImageUri } from "./dogProfile";

type Point = { lat: number; lng: number; t: number };
type LatLng = { lat: number; lng: number };

type RoutePayload = {
  id: string;
  title: string;
  durationSec: number;
  distanceM: number;
  points: LatLng[];
};

const mapHtmlAsset = require("../assets/kakaoMap.html");
const OSRM_BASE = "https://router.project-osrm.org";

/** -----------------------------
 * 개인화(보행속도) 저장
 * paceMpm = meters per minute (1분에 몇 m 걷는지)
 * 기본: 50m/min = 20분에 1km
 * ----------------------------- */
const STORAGE_KEYS = {
  paceMpm: "pace_m_per_min_v1",
};

async function loadPaceMpm(): Promise<number> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.paceMpm);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 20 && n < 120 ? n : 50;
}

async function savePaceMpm(v: number) {
  await AsyncStorage.setItem(STORAGE_KEYS.paceMpm, String(v));
}

function targetDistanceMByMinutes(minutes: number, paceMpm: number) {
  return minutes * paceMpm;
}

function makeWaypoint(home: LatLng, radiusM: number, deg: number): LatLng {
  // 매우 단순 근사: 위도 1도≈111,320m / 경도는 cos(lat)
  const rad = (deg * Math.PI) / 180;
  const dLat = (radiusM * Math.cos(rad)) / 111320;
  const dLng =
    (radiusM * Math.sin(rad)) / (111320 * Math.cos((home.lat * Math.PI) / 180));
  return { lat: home.lat + dLat, lng: home.lng + dLng };
}

async function fetchOsrmRoundTrip(
  home: LatLng,
  wp: LatLng
): Promise<{ durationSec: number; distanceM: number; points: LatLng[] }> {
  const coords = `${home.lng},${home.lat};${wp.lng},${wp.lat};${home.lng},${home.lat}`;
  const url = `${OSRM_BASE}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const json = await res.json();
  const route = json?.routes?.[0];
  if (!route) throw new Error("OSRM: no route");

  const durationSec = Number(route.duration ?? 0);
  const distanceM = Number(route.distance ?? 0);

  const coordsArr: [number, number][] = route.geometry?.coordinates ?? [];
  const points: LatLng[] = coordsArr.map(([lng, lat]) => ({ lat, lng }));

  return { durationSec, distanceM, points };
}

// -----------------------------
// ✅ OSM Overpass: 보행 친화 지점(공원/보행로) 후보를 가져오는 함수
// -----------------------------

/**
 * Overpass API는 OpenStreetMap 데이터를 쿼리할 수 있는 공개 API입니다.
 * - 장점: "공원/보행로" 같은 '인도 느낌' 지점을 waypoint 후보로 만들 수 있음
 * - 단점: 무료라서 가끔 느리거나 실패할 수 있음(그래서 timeout + fallback 필요)
 */
async function fetchWalkableWaypoints(
  center: LatLng,
  radiusM: number
): Promise<LatLng[]> {
  // ✅ 보행 친화 후보를 최대한 많이 모아야 선택의 폭이 넓어집니다.
  // 아래 쿼리는 중심점 주변 radiusM 반경에서:
  // - 보행로(footway/path/pedestrian)
  // - 공원(park)
  // 를 node/way/relation로 찾고, 중심점을 뽑아 way는 center로 뽑아줍니다.
  const query = `
[out:json][timeout:8];
(
  node(around:${radiusM},${center.lat},${center.lng})["highway"~"^(footway|path|pedestrian)$"];
  way(around:${radiusM},${center.lat},${center.lng})["highway"~"^(footway|path|pedestrian)$"];
  relation(around:${radiusM},${center.lat},${center.lng})["highway"~"^(footway|path|pedestrian)$"];

  node(around:${radiusM},${center.lat},${center.lng})["leisure"="park"];
  way(around:${radiusM},${center.lat},${center.lng})["leisure"="park"];
  relation(around:${radiusM},${center.lat},${center.lng})["leisure"="park"];
);
out center;
`;

  // ✅ timeout(네트워크/서버 느릴 때 무한 대기 방지)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    // Overpass는 보통 POST로 query를 보냅니다.
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!res.ok) return [];

    const json = await res.json();
    const els = Array.isArray(json?.elements) ? json.elements : [];

    // ✅ node는 lat/lon, way/relation은 center.lat/center.lon에 좌표가 들어옵니다.
    const pts: LatLng[] = [];
    for (const el of els) {
      if (typeof el?.lat === "number" && typeof el?.lon === "number") {
        pts.push({ lat: el.lat, lng: el.lon });
      } else if (
        typeof el?.center?.lat === "number" &&
        typeof el?.center?.lon === "number"
      ) {
        pts.push({ lat: el.center.lat, lng: el.center.lon });
      }
    }

    // ✅ 너무 많으면 중복이 많으니, 대충 중복 제거(격자 단위로)
    // 0.0005도 ≈ 50m 내외(위도 기준). 중복 제거 강도는 필요시 조절.
    const key = (p: LatLng) =>
      `${Math.round(p.lat / 0.0005)}:${Math.round(p.lng / 0.0005)}`;
    const uniq = new Map<string, LatLng>();
    for (const p of pts) uniq.set(key(p), p);

    return Array.from(uniq.values());
  } catch (e) {
    // 실패하면 빈 배열 반환하고, 상위 로직에서 fallback(기존 makeWaypoint) 사용
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 후보 점들 중에서 "목표 편도거리(oneWayM)에 가까운 점"만 골라서
 * waypoint로 쓰기 좋게 추립니다.
 */
function pickWaypointsNearDistance(
  center: LatLng,
  candidates: LatLng[],
  oneWayM: number,
  maxPick: number
): LatLng[] {
  // 거리 계산: 이미 파일에 haversineDistanceM가 있으니 그거 사용
  const withDist = candidates
    .map((p) => ({ p, d: haversineDistanceM(center, p) }))
    // ✅ 너무 가까우면 의미 없고, 너무 멀면 차도/산으로 빠질 가능성↑
    // oneWayM의 0.6~1.6 범위를 기본으로 (필요시 조절)
    .filter((x) => x.d >= oneWayM * 0.6 && x.d <= oneWayM * 1.6);

  // ✅ 목표 거리(oneWayM)와의 차이가 적은 순으로 정렬
  withDist.sort((a, b) => Math.abs(a.d - oneWayM) - Math.abs(b.d - oneWayM));

  // ✅ 다양성을 위해 상위 후보 중 일부는 랜덤 섞기(너무 비슷한 곳만 뽑히는 문제 방지)
  const top = withDist.slice(0, Math.min(withDist.length, 60)).map((x) => x.p);

  // Fisher-Yates shuffle로 랜덤 섞기
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }

  return top.slice(0, maxPick);
}


// 거리 계산(Haversine) - 개인화 학습용
function haversineDistanceM(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

function fmtMin(sec: number) {
  const m = Math.round(sec / 60);
  return `${m}분`;
}

function fmtKm(m: number) {
  if (m >= 1000) return `${(m / 1000).toFixed(2)}km`;
  return `${Math.round(m)}m`;
}

export default function KakaoMapWebView() {
  const webRef = useRef<WebView>(null);

  const [html, setHtml] = useState<string | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [home, setHome] = useState<LatLng | null>(null);

  const [devMock] = useState(__DEV__);
  const mockTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [dogBase64, setDogBase64] = useState<string | null>(null);

  const [isRecommending, setIsRecommending] = useState(false);

  // ✅ 입력 추천
  const [minuteText, setMinuteText] = useState("30");

  // ✅ 개인화 pace
  const [paceMpm, setPaceMpm] = useState<number>(50);

  // ✅ 추천 결과(3개) & 선택된 경로
  const [recommendedRoutes, setRecommendedRoutes] = useState<RoutePayload[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const selectedRoute = recommendedRoutes.find((r) => r.id === selectedRouteId) ?? null;

  // RN -> WebView
  const sendToMap = (payload: any) => {
    webRef.current?.postMessage(JSON.stringify(payload));
  };

  // 0) html 로드
  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(mapHtmlAsset);
      await asset.downloadAsync();
      const content = await FileSystem.readAsStringAsync(asset.localUri!);
      const kakaoKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? "";

      // HTML 안의 <script id="kakao-sdk"></script> 를
      // 실제 카카오 지도 SDK script로 바꿔치기
      const withKey = content.replace(
        `<script id="kakao-sdk"></script>`,
        `<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false"></script>`
      );

      // 키가 들어간 HTML을 WebView에 전달
      setHtml(withKey);

    })();
  }, []);

  // ✅ 개인화 pace 로드(앱 시작 1회)
  useEffect(() => {
    (async () => {
      const p = await loadPaceMpm();
      setPaceMpm(p);
    })();
  }, []);

  // 1) 위치 권한 + 홈 세팅
  useEffect(() => {
    if (!html) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      const h = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setHome(h);

      sendToMap({ type: "SET_LOCATION", lat: h.lat, lng: h.lng });
    })();
  }, [html]);

  // 1-1) 강아지 이미지(base64) 로드해서 지도에 뿌리기
  useEffect(() => {
    if (!html || !home) return;

    (async () => {
      const uri = await loadDogImageUri();
      if (!uri) return;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setDogBase64(base64);

      sendToMap({
        type: "SET_DOG",
        lat: home.lat,
        lng: home.lng,
        imageBase64: base64,
        nickname: "내 가나디",
        level: 1,
      });
    })();
  }, [html, home]);

  // ✅ 개발용: 가짜로 움직이기
  const startMockWalk = (startLat: number, startLng: number) => {
    let t = 0;
    if (mockTimer.current) clearInterval(mockTimer.current);

    mockTimer.current = setInterval(() => {
      t += 1;

      const r = 0.00015; // 약 15m
      const lat = startLat + r * Math.cos(t / 10);
      const lng = startLng + r * Math.sin(t / 10);

      const p = { lat, lng, t: Date.now() };

      setPoints((prev) => {
        const next = [...prev, p];
        sendToMap({ type: "SET_LOCATION", lat: p.lat, lng: p.lng });
        sendToMap({ type: "SET_PATH", points: next });
        // 강아지 위치도 같이 이동(선택)
        if (dogBase64) sendToMap({ type: "MOVE_DOG", lat: p.lat, lng: p.lng });
        return next;
      });
    }, 1000);
  };

  // 2) 산책 중 위치 추적(실제 GPS)
  useEffect(() => {
    if (!isWalking) return;

    let sub: Location.LocationSubscription | null = null;

    (async () => {
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (loc) => {
          const p = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            t: Date.now(),
          };

          setPoints((prev) => {
            const next = [...prev, p];
            sendToMap({ type: "SET_LOCATION", lat: p.lat, lng: p.lng });
            sendToMap({ type: "SET_PATH", points: next });
            if (dogBase64) sendToMap({ type: "MOVE_DOG", lat: p.lat, lng: p.lng });
            return next;
          });
        }
      );
    })();

    return () => sub?.remove();
  }, [isWalking, dogBase64]);

  const startWalk = () => {
    setPoints([]);
    setIsWalking(true);

    if (devMock) {
      const base = home ?? { lat: 37.5665, lng: 126.978 };
      startMockWalk(base.lat, base.lng);
    }
  };

  const stopWalk = async () => {
    setIsWalking(false);
    if (mockTimer.current) {
      clearInterval(mockTimer.current);
      mockTimer.current = null;
    }

    // ✅ 개인화 학습: 산책 종료 시 내 보행속도 업데이트
    if (points.length >= 10) {
      const durationMs = points[points.length - 1].t - points[0].t;
      const durationMin = durationMs / 60000;

      let distM = 0;
      for (let i = 1; i < points.length; i++) {
        distM += haversineDistanceM(points[i - 1], points[i]);
      }

      if (durationMin > 3 && distM > 200) {
        const observed = distM / durationMin; // m/min
        const clipped = Math.max(25, Math.min(observed, 110));

        const alpha = 0.25;
        const next = paceMpm * (1 - alpha) + clipped * alpha;

        setPaceMpm(next);
        await savePaceMpm(next);

        sendToMap({
          type: "TOAST",
          text: `개인화 업데이트: ${Math.round(next)}m/분`,
        });
      }
    }
  };

  // ✅ 추천 결과 선택(선택한 경로만 지도에 다시 그리기)
  const chooseRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    const r = recommendedRoutes.find((x) => x.id === routeId);
    if (!r) return;

    // 선택한 1개만 다시 표시
    sendToMap({ type: "CLEAR_ROUTES" });
    sendToMap({ type: "SET_ROUTES", routes: [r] });

    // 시작점 기준 강아지 마커 보정
    if (dogBase64 && home) {
      sendToMap({
        type: "SET_DOG",
        lat: home.lat,
        lng: home.lng,
        imageBase64: dogBase64,
        nickname: "내 가나디",
        level: 1,
      });
    }
  };

  // -----------------------------
  // ✅ 왕복+시간 추천(핵심)
  // -----------------------------
  const recommendRoundTrips = async (targetMin: number) => {
    try {
      setIsRecommending(true);
      sendToMap({ type: "CLEAR_ROUTES" });
      setRecommendedRoutes([]);
      setSelectedRouteId(null);

      // ✅ 1) 추천 시작점 = "지금 위치"
      let start: LatLng | null = null;

      if (points.length > 0) {
        const last = points[points.length - 1];
        start = { lat: last.lat, lng: last.lng };
      }

      if (!start) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          sendToMap({ type: "TOAST", text: "위치 권한이 필요해요" });
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        start = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      }

      setHome(start);
      sendToMap({ type: "SET_LOCATION", lat: start.lat, lng: start.lng });

      // ✅ 2) 개인화 pace 기반 목표거리
      const targetM = targetDistanceMByMinutes(targetMin, paceMpm);
      const targetSec = targetMin * 60;

      // 왕복 -> 편도
      const oneWayM_raw = targetM / 2;

      // ✅ 3) 분에 따라 상한 다르게
      const maxOneWay = targetMin <= 20 ? 700 : targetMin <= 30 ? 900 : 1300;
      const oneWayM = Math.max(200, Math.min(oneWayM_raw, maxOneWay));

      // -----------------------------
      // ✅ 3) waypoint 후보 만들기 (인도/공원 우선)
      // -----------------------------

      // 3-1) Overpass로 "보행 친화 지점" 후보를 먼저 가져옵니다.
      // 반경은 oneWayM의 2.0배 정도로 잡아두면 후보가 꽤 나옵니다.
      const walkableCandidates = await fetchWalkableWaypoints(start!, Math.round(oneWayM * 2.0));

      // 3-2) 후보 중에서 목표 편도거리(oneWayM)에 가까운 점들을 waypoint로 추립니다.
      // maxPick은 OSRM 호출량과 직결이라 12~20 추천(여기선 12개)
      let candidates: LatLng[] = pickWaypointsNearDistance(start!, walkableCandidates, oneWayM, 12);

      // 3-3) 만약 후보가 너무 적으면(Overpass 실패/근처에 공원/보행로가 없는 경우)
      // 기존 방식(원형 waypoint)으로 fallback 해서 "추천이 아예 안 뜨는 상황"을 막습니다.
      if (candidates.length < 6) {
        const degrees = Array.from({ length: 12 }, (_, i) => i * 30); // 0..330
        const radial = degrees.map((deg) => makeWaypoint(start!, oneWayM, deg));
        // 섞어서 부족한 만큼만 채우기
        candidates = [...candidates, ...radial].slice(0, 12);
      }


      const results: {
        wp: LatLng;
        durationSec: number;
        distanceM: number;
        points: LatLng[];
      }[] = [];

      const batchSize = 6;
      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const settled = await Promise.allSettled(batch.map((wp) => fetchOsrmRoundTrip(start!, wp)));
        settled.forEach((s, idx) => {
          if (s.status === "fulfilled") results.push({ wp: batch[idx], ...s.value });
        });
      }

      if (results.length === 0) {
        sendToMap({ type: "TOAST", text: "추천 경로를 가져오지 못했어요(네트워크 확인)" });
        return;
      }

      const filtered = results.filter(
        (r) => r.distanceM >= targetM * 0.6 && r.distanceM <= targetM * 1.6
      );

      if (filtered.length === 0) {
        sendToMap({
          type: "TOAST",
          text: "근처에서 조건에 맞는 경로를 찾지 못했어요. 다시 눌러주세요.",
        });
        return;
      }

      const scored = filtered
        .map((r) => {
          const timeDiff = Math.abs(r.durationSec - targetSec);
          const distDiff = Math.abs(r.distanceM - targetM);
          const score = timeDiff * 1.2 + distDiff * 0.4;
          return { ...r, score };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);

      const routes: RoutePayload[] = scored.map((r, idx) => ({
        id: `r${idx + 1}`,
        title: `${targetMin}분(≈${Math.round(targetM)}m) 추천 ${idx + 1}`,
        durationSec: r.durationSec,
        distanceM: r.distanceM,
        points: r.points,
      }));

      setRecommendedRoutes(routes);

      sendToMap({ type: "SET_ROUTES", routes });

      // 강아지 마커 다시 찍기(시작점 기준)
      if (dogBase64) {
        sendToMap({
          type: "SET_DOG",
          lat: start.lat,
          lng: start.lng,
          imageBase64: dogBase64,
          nickname: "내 가나디",
          level: 1,
        });
      }
    } finally {
      setIsRecommending(false);
    }
  };

  const canStartWithRoute = !!selectedRoute && !isWalking;

  return (
    <View style={{ flex: 1 }}>
      {html && (
        <WebView
          ref={webRef}
          originWhitelist={["*"]}
          source={{ html, baseUrl: "http://localhost" }}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowFileAccess
          allowUniversalAccessFromFileURLs
          style={{ flex: 1, zIndex: 0 }}
          onError={(e) => console.log("WV error", e.nativeEvent)}
          onHttpError={(e) => console.log("WV httpError", e.nativeEvent)}
        />
      )}

      {/* ✅ 입력 추천(분) */}
      <View style={styles.inputRow} pointerEvents="box-none">
        <TextInput
          value={minuteText}
          onChangeText={(v) => setMinuteText(v.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          placeholder="분(10~120)"
          placeholderTextColor="#888"
          style={styles.input}
        />
        <Pressable
          style={[styles.recoBtn, isRecommending && styles.disabled]}
          disabled={isRecommending}
          onPress={() => {
            const m = Number(minuteText);
            if (!Number.isFinite(m) || m < 10 || m > 120) {
              sendToMap({ type: "TOAST", text: "10~120분 사이로 입력해줘요" });
              return;
            }
            recommendRoundTrips(m);
          }}
        >
          <Text style={styles.recoText}>추천</Text>
        </Pressable>

        <View style={styles.pacePill}>
          <Text style={styles.paceText}>{Math.round(paceMpm)}m/분</Text>
        </View>

        {isRecommending && <ActivityIndicator style={{ marginLeft: 6 }} />}
      </View>

      {/* ✅ 추천 결과(3개) 선택 바 */}
      {recommendedRoutes.length > 0 && (
        <View style={styles.pickBar} pointerEvents="box-none">
          {recommendedRoutes.map((r, idx) => {
            const active = r.id === selectedRouteId;
            return (
              <Pressable
                key={r.id}
                style={[styles.pickBtn, active && styles.pickBtnActive]}
                onPress={() => chooseRoute(r.id)}
              >
                <Text style={[styles.pickTitle, active && styles.pickTitleActive]}>
                  추천{idx + 1}
                </Text>
                <Text style={[styles.pickSub, active && styles.pickSubActive]}>
                  {fmtMin(r.durationSec)} · {fmtKm(r.distanceM)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* 하단 버튼 UI */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        {!isWalking ? (
          <>
            <Pressable
              style={[styles.btn, !canStartWithRoute && styles.disabledBtn]}
              disabled={!canStartWithRoute}
              onPress={() => {
                // 선택된 경로 기반 산책 시작
                // (여기서부터 isWalking=true로 GPS 추적 시작)
                // 선택 경로는 지도에 남아있고, 실제 산책 경로는 SET_PATH로 덧그려짐
                startWalk();
              }}
            >
              <Text style={styles.btnText}>
                {canStartWithRoute ? "이 경로로 산책 시작" : "경로를 선택하세요"}
              </Text>
            </Pressable>

            {/* 혹시 그냥 기록만 시작하고 싶으면 아래 버튼을 남겨도 됨 (원하면 제거 가능)
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={startWalk}>
              <Text style={styles.btnText}>그냥 산책 시작</Text>
            </Pressable>
            */}
          </>
        ) : (
          <Pressable style={styles.btn} onPress={stopWalk}>
            <Text style={styles.btnText}>산책 종료</Text>
          </Pressable>
        )}
      </View>

      {/* 오른쪽 하단 신고 버튼(그대로) */}
      <Pressable style={styles.reportBtn} onPress={() => alert("신고(다음 단계)")}>
        <Text style={styles.reportText}>신고</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // ✅ 입력 추천 UI
  inputRow: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 160,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    elevation: 10,
  },
  input: {
    width: 110,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#1a1a1a",
    color: "white",
    borderWidth: 1,
    borderColor: "#333",
  },
  recoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
  },
  recoText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },

  pacePill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
  },
  paceText: { color: "#ddd", fontWeight: "800" },

  // ✅ 추천 3개 선택 바
  pickBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 104,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  pickBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  pickBtnActive: {
    backgroundColor: "#1f1f1f",
    borderColor: "#555",
  },
  pickTitle: { color: "white", fontWeight: "900", marginBottom: 2 },
  pickTitleActive: { color: "white" },
  pickSub: { color: "#bbb", fontWeight: "700", fontSize: 12 },
  pickSubActive: { color: "#eee" },

  // 하단 버튼
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "black",
  },
  disabledBtn: { opacity: 0.6 },
  btnText: { color: "white", fontWeight: "800" },

  reportBtn: {
    position: "absolute",
    right: 16,
    bottom: 130,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    elevation: 10,
  },
  reportText: { color: "white", fontWeight: "800" },
});
