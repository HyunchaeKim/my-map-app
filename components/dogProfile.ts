// components/dogProfile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "DOG_PROFILE_IMAGE_URI";

export async function saveDogImageUri(uri: string) {
  await AsyncStorage.setItem(KEY, uri);
}

export async function loadDogImageUri(): Promise<string | null> {
  return await AsyncStorage.getItem(KEY);
}

export async function clearDogImageUri() {
  await AsyncStorage.removeItem(KEY);
}
