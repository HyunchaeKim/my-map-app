// app/(tabs)/index.tsx
import KakaoMapWebView from "@/components/kakaoMapWebView";
import React from "react";
import { View } from "react-native";

export default function IndexScreen() {
  return (
    <View style={{ flex: 1 }}>
      <KakaoMapWebView />
    </View>
  );
}
