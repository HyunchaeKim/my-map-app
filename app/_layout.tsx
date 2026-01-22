// app/_layout.tsx
import { VisitsProvider } from "@/hooks/visits";
import { Stack } from "expo-router";
import React from "react";

export default function RootLayout() {
  return (
    <VisitsProvider>
        <Stack screenOptions={{ headerShown: false }} />
    </VisitsProvider>
  );
}
