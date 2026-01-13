import { usePosts } from "@/components/PostStore";
import PostTile from "@/components/PostTile";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";

export default function ExploreScreen() {
  const router = useRouter();
  const { posts } = usePosts();

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return posts;

    return posts.filter(
      (p) =>
        (p.caption ?? "").toLowerCase().includes(keyword) ||
        p.userName.toLowerCase().includes(keyword)
    );
  }, [q, posts]);

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="검색"
          placeholderTextColor="#999"
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <PostTile
            uri={item.imageUri}
            onPress={() =>
              router.push({
                pathname: "/post/[id]",
                params: { id: item.id },
              })
            }
          />
        )}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  searchWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  search: {
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 12,
    color: "white",
  },
  grid: { paddingBottom: 24 },
  row: { gap: 2 },
});
