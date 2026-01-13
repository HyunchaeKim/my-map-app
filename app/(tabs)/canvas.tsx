// app/(tabs)/canvas.tsx
import KoreaCanvas from "@/components/KoreaCanvas";
import { useVisits } from "@/hooks/visits";
import React from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

export default function CanvasScreen() {
  const { visits } = useVisits();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1 }}>
        <KoreaCanvas visits={visits} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "white" },
});
