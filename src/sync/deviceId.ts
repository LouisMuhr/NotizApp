import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const KEY = '@notizapp_device_id';

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const fromEnv = process.env.EXPO_PUBLIC_DEVICE_ID;
  if (fromEnv && fromEnv.trim().length > 0) {
    const v = fromEnv.trim();
    cached = v;
    return v;
  }
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) {
    cached = existing;
    return existing;
  }
  const fresh = uuidv4();
  await AsyncStorage.setItem(KEY, fresh);
  cached = fresh;
  return fresh;
}

export function isDeviceIdFromEnv(): boolean {
  const v = process.env.EXPO_PUBLIC_DEVICE_ID;
  return Boolean(v && v.trim().length > 0);
}
