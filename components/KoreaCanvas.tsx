// components/KoreaCanvas.tsx
import { geoMercator, geoPath } from "d3-geo";
import React, { useMemo, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import type { VisitRecord } from "../constants/visit"; // alias 불안하면 상대경로
import { featureContainsPoint } from "../utils/geo";

// ✅ 여기 파일 경로는 처장님 폴더에 맞춰주세요.
// 현재 스샷 기준: assets/skorea-municipalities-2018-geo.json
import koreaGeo from "../assets/skorea-municipalities-2018-geo.json";

type Props = {
  visits: VisitRecord[];
};

type AnyFeature = any;

function getFeatureId(f: AnyFeature, idx: number) {
  const p = f?.properties || {};
  return (
    p.adm_cd ||     // 어떤 파일은 이 키
    p.code ||       // 어떤 파일은 code
    p.sig_cd ||     // 또는 sig_cd
    p.name ||       // 최후 fallback
    String(idx)
  );
}

function colorForCount(c: number) {
  // 0이면 거의 흰색, 많을수록 진하게(원하면 임계값 튜닝)
  if (c >= 20) return "#3b0a45";
  if (c >= 10) return "#6a1b9a";
  if (c >= 5) return "#8e24aa";
  if (c >= 2) return "#ba68c8";
  if (c >= 1) return "#e1bee7";
  return "#f7f2f8";
}

export default function KoreaCanvas({ visits }: Props) {
  const [w] = useState(() => Math.min(Dimensions.get("window").width, 520));
  const h = Math.round(w * 1.15);

  const fc = koreaGeo as any;

  const { pathGen, features } = useMemo(() => {
    const proj = geoMercator();
    proj.fitSize([w, h], fc as any);
    const pg = geoPath(proj as any);

    const feats: AnyFeature[] = fc?.features ?? [];
    return { pathGen: pg, features: feats };
  }, [w, h, fc]);

  // ✅ 시군구별 방문 횟수 집계 (point-in-polygon)
  const countByFeatureId = useMemo(() => {
    const map: Record<string, number> = {};

    // 방문이 없으면 바로 리턴
    if (!visits?.length) return map;

    // feature별로 "몇 번 방문 좌표가 들어갔는지" 세기
    features.forEach((f, idx) => {
      const id = getFeatureId(f, idx);
      let cnt = 0;

      for (const v of visits) {
        // visit 좌표는 VisitRecord의 lat/lng 사용
        if (featureContainsPoint(f, v.lng, v.lat)) cnt += v.visitCount ?? 1;
      }

      if (cnt > 0) map[id] = cnt;
    });

    return map;
  }, [features, visits]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>나만의 한국 도화지도</Text>
      <Text style={styles.sub}>
        방문 많은 지역이 더 진하게 칠해집니다 (시군구 단위)
      </Text>

      <View style={[styles.canvas, { width: w, height: h }]}>
        <Svg width={w} height={h}>
          <G>
            {features.map((f, idx) => {
              const d = pathGen(f as any);
              if (!d) return null;

              const id = getFeatureId(f, idx);
              const cnt = countByFeatureId[id] ?? 0;

              return (
                <Path
                  key={id}
                  d={d}
                  fill={colorForCount(cnt)}
                  stroke="#222"
                  strokeWidth={0.4}
                />
              );
            })}
          </G>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "white", padding: 16 },
  title: { fontSize: 18, fontWeight: "900" },
  sub: { marginTop: 6, marginBottom: 12, color: "#555" },
  canvas: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "white",
    alignSelf: "center",
  },
});
