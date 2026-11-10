// Hersteller-Gruppen mit eigenen Hintergrund-Sperren (Autostart, App-Start-Verwaltung, Tiefschlaf).
// Auf solchen Geräten kommt ein pünktlich ausgelöster Alarm sonst nie als Benachrichtigung an:
// das System startet die App nicht, um sie anzuzeigen (auf Xiaomi im Log: "proc frequent died").
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export type BackgroundVendor = 'xiaomi' | 'huawei' | 'oppo' | 'vivo' | 'samsung' | 'other';

const VENDOR_PATTERNS: [BackgroundVendor, RegExp][] = [
  ['xiaomi', /xiaomi|redmi|poco/],
  ['huawei', /huawei|honor/],
  ['oppo', /oppo|realme|oneplus/],
  ['vivo', /vivo|iqoo/],
  ['samsung', /samsung/],
];

/** Ordnet Hersteller/Marke (expo-device) einer Gruppe zu; unbekannt oder reines Android → 'other'. */
export function getBackgroundVendor(
  manufacturer: string | null | undefined,
  brand?: string | null,
): BackgroundVendor {
  const haystack = `${manufacturer ?? ''} ${brand ?? ''}`.toLowerCase();
  for (const [vendor, pattern] of VENDOR_PATTERNS) {
    if (pattern.test(haystack)) return vendor;
  }
  return 'other';
}

/** Gruppe des laufenden Geräts; außerhalb von Android immer 'other' (iOS kennt die Sperren nicht). */
export function currentBackgroundVendor(): BackgroundVendor {
  return Platform.OS === 'android' ? getBackgroundVendor(Device.manufacturer, Device.brand) : 'other';
}
