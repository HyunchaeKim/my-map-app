// components/AddVisitModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  visible: boolean;
  lat: number;
  lng: number;
  onClose: () => void;
  onSave: (payload: { placeName: string; note: string; visitedAt: string; placeId?: string }) => void;
};

export default function AddVisitModal({ visible, lat, lng, onClose, onSave }: Props) {
  const nowLocalISO = useMemo(() => {
    // 입력 기본값용(로컬 시간대). 저장할 때 Index에서 ISO로 통일해도 됨
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }, [visible]);

  const [placeName, setPlaceName] = useState("");
  const [note, setNote] = useState("");
  const [visitedAtLocal, setVisitedAtLocal] = useState(nowLocalISO);

  useEffect(() => {
    if (visible) {
      setPlaceName("");
      setNote("");
      setVisitedAtLocal(nowLocalISO);
    }
  }, [visible, nowLocalISO]);

  const disabled = placeName.trim().length === 0 || visitedAtLocal.trim().length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.h}>방문 기록 추가</Text>

          <Text style={styles.label}>선택 좌표</Text>
          <Text style={styles.meta}>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>

          <Text style={styles.label}>가게 이름</Text>
          <TextInput
            value={placeName}
            onChangeText={setPlaceName}
            placeholder="예) 홍콩반점 보라매점"
            style={styles.input}
          />

          <Text style={styles.label}>메모(선택)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="예) 짬뽕 맛있음"
            style={[styles.input, { height: 90 }]}
            multiline
          />

          <Text style={styles.label}>방문일시</Text>
          <TextInput
            value={visitedAtLocal}
            onChangeText={setVisitedAtLocal}
            placeholder="YYYY-MM-DDTHH:mm"
            style={styles.input}
          />

          <View style={styles.row}>
            <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnTextGhost}>닫기</Text>
            </Pressable>

            <Pressable
              onPress={() => onSave({ placeName, note, visitedAt: visitedAtLocal })}
              style={[styles.btn, disabled ? styles.btnDisabled : styles.btnPrimary]}
              disabled={disabled}
            >
              <Text style={styles.btnTextPrimary}>저장</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  h: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  label: { fontWeight: "700", marginTop: 10, marginBottom: 6 },
  meta: { color: "#555" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12 },
  btnGhost: { borderWidth: 1, borderColor: "#ddd", backgroundColor: "white" },
  btnPrimary: { backgroundColor: "black" },
  btnDisabled: { backgroundColor: "#999" },
  btnTextPrimary: { color: "white", fontWeight: "800" },
  btnTextGhost: { color: "black", fontWeight: "800" },
});
