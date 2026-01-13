// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "산책하기" }} />
      <Tabs.Screen name="canvas" options={{ title: "나와바리" }} />
      <Tabs.Screen name="explore" options={{ title: "돋보기" }} />
      <Tabs.Screen name="community" options={{ title: "커뮤니티" }} />
      <Tabs.Screen name="profile" options={{ title: "프로필" }} />
    </Tabs>
  );
}
