import { usePosts } from "@/components/PostStore";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function NewPost() {
  const router = useRouter();
  const { addPost } = usePosts();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("권한 필요");
      return;
    }

    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!r.canceled) setImageUri(r.assets[0].uri);
  };

  const submit = () => {
    if (!imageUri) return;

    addPost({
      id: Date.now().toString(),
      userId: "me",
      userName: "현빠",
      imageUri,
      caption,
      createdAt: Date.now(),
      likeCount: 0,
    });

    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>새 게시물</Text>

      <Pressable onPress={pickImage} style={styles.imageBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <Text style={{ color: "#aaa" }}>사진 선택</Text>
        )}
      </Pressable>

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="문구 입력..."
        placeholderTextColor="#777"
        style={styles.input}
      />

      <Pressable style={styles.submit} onPress={submit}>
        <Text style={{ fontWeight: "800" }}>업로드</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "black" },
  title: { color: "white", fontSize: 20, fontWeight: "800", marginBottom: 12 },
  imageBox: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: 12,
  },
  image: { width: "100%", height: "100%", borderRadius: 12 },
  input: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#111",
    paddingHorizontal: 12,
    color: "white",
    marginBottom: 12,
  },
  submit: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
});
