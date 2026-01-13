// app/(tabs)/explore.tsx
import { useVisits } from "@/hooks/visits";
import React from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

export default function ExploreScreen() {
  const { visits } = useVisits(); // visits는 나중에 다른 UI에서 쓸 수도 있으니 남겨둬도 됨

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {/* ... 기존 헤더 ... */}
      </View>

      <View style={{ flex: 1 }}>
        {/* 여기에는 다른 내용 넣기 (예: SNS 탐색, 추천 산책로 등) */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "white" },
  header: { /* 기존 그대로 */ },
});
