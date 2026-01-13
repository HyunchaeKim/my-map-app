// utils/visitsStore.ts
import type { VisitRecord } from "@/constants/visit";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "VISIT_RECORDS_V1";

export async function loadVisits(): Promise<VisitRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveVisits(list: VisitRecord[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}
