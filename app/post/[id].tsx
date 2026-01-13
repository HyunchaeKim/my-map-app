// app/post/[id].tsx
import { MOCK_POSTS } from "@/data/mockPosts";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = MOCK_POSTS.find(p => p.id === id);

  if (!post) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "white" }}>게시물을 찾을 수 없어요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: post.imageUri }} style={styles.image} />
      <Text style={styles.caption}>{post.userName}  {post.caption ?? ""}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  image: { width: "100%", aspectRatio: 1 },
  caption: { color: "white", padding: 12 },
});
