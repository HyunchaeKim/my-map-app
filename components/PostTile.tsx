// components/PostTile.tsx
import React from "react";
import { Image, Pressable, StyleSheet } from "react-native";

export default function PostTile({
  uri,
  onPress,
}: {
  uri: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <Image source={{ uri }} style={styles.img} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, aspectRatio: 1, marginBottom: 2 },
  img: { width: "100%", height: "100%" },
});
