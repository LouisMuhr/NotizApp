import { Linking } from 'react-native';

// Einzige Fassung von Datenschutzerklärung und Impressum liegt in der Webapp
// (webapp/app/privacy, webapp/app/impressum); `app.json` → privacyPolicyUrl zeigt ebenfalls dorthin.
export const PRIVACY_URL = 'https://www.velmnote.com/privacy';
export const IMPRINT_URL = 'https://www.velmnote.com/impressum';

export function openPrivacyPolicy() {
  Linking.openURL(PRIVACY_URL).catch(() => {});
}

export function openImprint() {
  Linking.openURL(IMPRINT_URL).catch(() => {});
}
