import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
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

function metersPerMin(speedKmh = 4.5) {
  // 4.5km/h = 4500m / 60min = 75m/min
  return (speedKmh * 1000) / 60;
}

function makeWaypoint(home: LatLng, radiusM: number, deg: number): LatLng {
  // 매우 단순 근사: 위도 1도≈111,320m / 경도는 cos(lat)
  const rad = (deg * Math.PI) / 180;
  const dLat = (radiusM * Math.cos(rad)) / 111320;
  const dLng = (radiusM * Math.sin(rad)) / (111320 * Math.cos((home.lat * Math.PI) / 180));
  return { lat: home.lat + dLat, lng: home.lng + dLng };
}

async function fetchOsrmRoundTrip(home: LatLng, wp: LatLng): Promise<{ durationSec: number; distanceM: number; points: LatLng[] }> {
  // OSRM은 lng,lat 순서
  const coords = `${home.lng},${home.lat};${wp.lng},${wp.lat};${home.lng},${home.lat}`;
  const radiuses = `radiuses=80;80;80`;
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
      setHtml(content);
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
          const p = { lat: loc.coords.latitude, lng: loc.coords.longitude, t: Date.now() };

          setPoints((prev) => {
            const next = [...prev, p];
            sendToMap({ type: "SET_LOCATION", lat: p.lat, lng: p.lng });
            sendToMap({ type: "SET_PATH", points: next });
            return next;
          });
        }
      );
    })();

    return () => sub?.remove();
  }, [isWalking]);

  const startWalk = () => {
    setPoints([]);
    setIsWalking(true);

    if (devMock) {
      const base = home ?? { lat: 37.5665, lng: 126.978 };
      startMockWalk(base.lat, base.lng);
    }
  };

  const stopWalk = () => {
    setIsWalking(false);
    if (mockTimer.current) {
      clearInterval(mockTimer.current);
      mockTimer.current = null;
    }
  };

  // -----------------------------
  // ✅ 왕복+시간 추천(핵심)
  // -----------------------------
  const recommendRoundTrips = async (targetMin: number) => {
    if (!home) return;
    

    try {
      setIsRecommending(true);
      sendToMap({ type: "CLEAR_ROUTES" });

      const targetSec = targetMin * 60;

      // 총거리 ≈ 시간 * 75m, 왕복이므로 편도 반
      const totalM = targetMin * metersPerMin(4.5);
      const oneWayM = totalM / 2;

      // 후보 waypoint 여러 개 생성
      const degrees = Array.from({ length: 18 }, (_, i) => i * 20); // 0..340 (20도 간격)
      const candidates = degrees.map((deg) => makeWaypoint(home, oneWayM, deg));

      // OSRM 호출(너무 많이 동시에 때리면 느리니 6개씩 배치)
      const results: { wp: LatLng; durationSec: number; distanceM: number; points: LatLng[] }[] = [];

      const batchSize = 6;
      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const settled = await Promise.allSettled(batch.map((wp) => fetchOsrmRoundTrip(home, wp)));

        settled.forEach((s, idx) => {
          if (s.status === "fulfilled") {
            results.push({ wp: batch[idx], ...s.value });
          }
        });
      }

      if (results.length === 0) {
        sendToMap({ type: "TOAST", text: "추천 경로를 가져오지 못했어요(네트워크 확인)" });
        return;
      }

      // 점수화: 목표시간 오차가 적을수록 좋게
      const scored = results
        .map((r) => {
          const timeDiff = Math.abs(r.durationSec - targetSec);
          // 너무 짧거나 너무 길면 페널티 크게
          const penalty = timeDiff;
          return { ...r, score: penalty };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);

      const routes: RoutePayload[] = scored.map((r, idx) => ({
        id: `r${idx + 1}`,
        title: `${targetMin}분 추천 ${idx + 1}`,
        durationSec: r.durationSec,
        distanceM: r.distanceM,
        points: r.points,
      }));

      sendToMap({ type: "SET_ROUTES", routes });

      // 강아지도 다시 찍어주기(경로 그리면서 마커가 초기화될 수도 있으니)
      if (dogBase64) {
        sendToMap({
          type: "SET_DOG",
          lat: home.lat,
          lng: home.lng,
          imageBase64: dogBase64,
          nickname: "내 가나디",
          level: 1,
        });
      }
    } finally {
      setIsRecommending(false);
    }
  };

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

      {/* 하단 버튼 UI */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        {!isWalking ? (
          <Pressable style={styles.btn} onPress={startWalk}>
            <Text style={styles.btnText}>산책 시작</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.btn} onPress={stopWalk}>
            <Text style={styles.btnText}>산책 종료</Text>
          </Pressable>
        )}

        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => sendToMap({ type: "SET_PATH", points })}>
          <Text style={styles.btnText}>내 영토</Text>
        </Pressable>
      </View>

      {/* ✅ 추천 버튼 바 */}
      <View style={styles.recoBar} pointerEvents="box-none">
        <Pressable
          style={[styles.recoBtn, isRecommending && styles.disabled]}
          disabled={isRecommending}
          onPress={() => recommendRoundTrips(20)}
        >
          <Text style={styles.recoText}>20분 추천</Text>
        </Pressable>

        <Pressable
          style={[styles.recoBtn, isRecommending && styles.disabled]}
          disabled={isRecommending}
          onPress={() => recommendRoundTrips(30)}
        >
          <Text style={styles.recoText}>30분 추천</Text>
        </Pressable>

        <Pressable
          style={[styles.recoBtn, isRecommending && styles.disabled]}
          disabled={isRecommending}
          onPress={() => recommendRoundTrips(45)}
        >
          <Text style={styles.recoText}>45분 추천</Text>
        </Pressable>

        {isRecommending && <ActivityIndicator style={{ marginLeft: 8 }} />}
      </View>

      {/* 오른쪽 하단 신고 버튼(그대로) */}
      <Pressable style={styles.reportBtn} onPress={() => alert("신고(다음 단계)")}>
        <Text style={styles.reportText}>신고</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  btnGhost: { backgroundColor: "#222" },
  btnText: { color: "white", fontWeight: "700" },

  recoBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 70,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  recoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
  },
  recoText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },

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
