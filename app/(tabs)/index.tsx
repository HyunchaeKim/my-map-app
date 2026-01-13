// app/(tabs)/index.tsx
import KakaoMapWebView from "@/components/kakaoMapWebView"; // ✅ 파일명/import 대문자 통일 추천
import React from "react";
import { View } from "react-native";

export default function IndexScreen() {
  return (
    <View style={{ flex: 1 }}>
      <KakaoMapWebView />
    </View>
  );
}
