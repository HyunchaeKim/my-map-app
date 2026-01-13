// components/RevisitConfirmModal.tsx
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export default function RevisitConfirmModal({
  visible,
  onClose,
  onYes,
  onNo,
}: {
  visible: boolean;
  onClose: () => void;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.h}>이 근처 동일 가게 후보가 있어요.</Text>
          <Text style={styles.sub}>기존 장소에 합칠까요?</Text>

          <View style={styles.row}>
            <Pressable onPress={onNo} style={[styles.btn, styles.ghost]}>
              <Text style={styles.ghostText}>아니오(새로)</Text>
            </Pressable>

            <Pressable onPress={onYes} style={[styles.btn, styles.primary]}>
              <Text style={styles.primaryText}>예(합치기)</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  box: { width: "86%", backgroundColor: "white", borderRadius: 16, padding: 16 },
  h: { fontSize: 16, fontWeight: "900" },
  sub: { marginTop: 6, color: "#444" },
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  ghost: { borderWidth: 1, borderColor: "#ddd", backgroundColor: "white" },
  primary: { backgroundColor: "black" },
  primaryText: { color: "white", fontWeight: "900" },
  ghostText: { color: "black", fontWeight: "900" },
});
