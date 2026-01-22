import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: "지도" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "프로필" }}
      />
    </Tabs>
  );
}
