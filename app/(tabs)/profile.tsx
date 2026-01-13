import { clearDogImageUri, loadDogImageUri, saveDogImageUri } from "@/components/dogProfile";
import { usePosts } from "@/components/PostStore";
import PostTile from "@/components/PostTile";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function ProfileScreen() {
  const router = useRouter();
  const { posts } = usePosts();

  const [dogUri, setDogUri] = useState<string | null>(null);

  const MY_USER_ID = "me";

  const myPosts = useMemo(
    () => posts.filter((p) => p.userId === MY_USER_ID),
    [posts]
  );

  useEffect(() => {
    (async () => {
      const saved = await loadDogImageUri();
      setDogUri(saved);
    })();
  }, []);

  const pickDogImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("권한 필요", "사진을 선택하려면 사진 접근 권한이 필요해요.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    await saveDogImageUri(uri);
    setDogUri(uri);
  };

  const removeDogImage = async () => {
    await clearDogImageUri();
    setDogUri(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>프로필</Text>

      <View style={styles.card}>
        <Text style={styles.label}>내 가나디</Text>

        <View style={styles.avatarWrap}>
          {dogUri ? (
            <Image source={{ uri: dogUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text style={styles.avatarEmptyText}>사진 없음</Text>
            </View>
          )}
        </View>

        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={pickDogImage}>
            <Text style={styles.btnText}>{dogUri ? "사진 변경" : "사진 등록"}</Text>
          </Pressable>

          {dogUri && (
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={removeDogImage}>
              <Text style={styles.btnTextGhost}>삭제</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.hint}>
          팁: 얼굴/몸이 잘 보이게 정사각형으로 크롭하면 지도에서 캐릭터처럼 예뻐 보여요.
        </Text>

        {/* ✅ 게시물 추가 */}
        <Pressable style={[styles.btn, { marginTop: 12 }]} onPress={() => router.push("/post/new")}>
          <Text style={styles.btnText}>➕ 게시물 추가</Text>
        </Pressable>
      </View>

      {/* ✅ 내 게시물 그리드 */}
      <FlatList
        style={{ marginTop: 12 }}
        data={myPosts}
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
        columnWrapperStyle={{ gap: 2 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={{ padding: 20 }}>
            <Text style={{ color: "#aaa" }}>아직 게시물이 없어요.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 40, backgroundColor: "black" },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 16, color: "white" },

  card: { padding: 16, borderRadius: 16, backgroundColor: "#111" },
  label: { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 12 },

  avatarWrap: { alignItems: "center", marginBottom: 16 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#333" },
  avatarEmpty: { justifyContent: "center", alignItems: "center" },
  avatarEmptyText: { color: "#bbb", fontWeight: "700" },

  row: { flexDirection: "row", justifyContent: "center", gap: 10 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: "white", alignItems: "center" },
  btnGhost: { backgroundColor: "#222" },
  btnText: { color: "black", fontWeight: "800" },
  btnTextGhost: { color: "white", fontWeight: "800" },

  hint: { color: "#bbb", marginTop: 12, lineHeight: 18 },
});
