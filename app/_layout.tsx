// app/_layout.tsx

import { PostProvider } from "@/components/PostStore";
import { VisitsProvider } from "@/hooks/visits";
import { Stack } from "expo-router";
import React from "react";

export default function RootLayout() {
  return (
    <VisitsProvider>
      <PostProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PostProvider>
    </VisitsProvider>
  );
}
