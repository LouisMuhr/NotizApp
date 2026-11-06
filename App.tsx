import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { NotesProvider } from './src/context/NotesContext';
import { ThoughtsProvider } from './src/context/ThoughtsContext';
import { AppTheme, Tokens } from './src/theme/theme';
import AppNavigator from './src/navigation/AppNavigator';
import ShareHandler from './src/components/ShareHandler';
import ReengagementBootstrap from './src/components/ReengagementBootstrap';
import { isReengagementNotification } from './src/utils/reengagement';
import OnboardingScreen, { ONBOARDING_KEY } from './src/screens/onboarding';
import { requestNotificationPermissions } from './src/utils/notifications';
import { useSplashHide } from './src/utils/splash';
import { useNotes } from './src/context/NotesContext';
import { LogBox } from 'react-native';
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

// Native Splash bleibt sichtbar, bis Fonts, Onboarding-Flag und Notizen bereit sind.
SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Tokens.paper,
    card: Tokens.paper,
    text: Tokens.ink,
    primary: Tokens.amberDeep,
    border: Tokens.rule,
  },
};

const navigationRef = createNavigationContainerRef();

function SplashGate() {
  const { loading } = useNotes();
  useSplashHide(!loading);
  return null;
}

function NotificationBootstrap() {
  const { rescheduleAllReminders } = useNotes();
  const appState = useRef(AppState.currentState);
  const lastReschedule = useRef(0);

  useEffect(() => {
    requestNotificationPermissions();

    function handleTap(response: Notifications.NotificationResponse) {
      const { identifier, content } = response.notification.request;
      const data = content.data as Record<string, unknown> | undefined;
      const navigate = (fn: () => void) => {
        const tryNav = () => {
          if (navigationRef.isReady()) fn();
          else setTimeout(tryNav, 100);
        };
        tryNav();
      };
      // Rückkehr-Benachrichtigung: App öffnen, bei 'Notizen ohne Thread' direkt in den Threads-Tab.
      if (isReengagementNotification(identifier, data)) {
        const screen = data?.target === 'Threads' ? 'Threads' : 'Notizen';
        navigate(() => (navigationRef as any).navigate('Home', { screen }));
        return;
      }
      const noteId = data?.noteId as string | undefined;
      if (!noteId) return;
      navigate(() => (navigationRef as any).navigate('NoteDetail', { noteId }));
    }

    const tapSub = Notifications.addNotificationResponseReceivedListener(handleTap);
    Notifications.getLastNotificationResponseAsync().then((r) => { if (r) handleTap(r); });

    const stateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasBackground = appState.current === 'background' || appState.current === 'inactive';
      appState.current = next;
      if (wasBackground && next === 'active') {
        const now = Date.now();
        if (now - lastReschedule.current > 10 * 60 * 1000) {
          lastReschedule.current = now;
          rescheduleAllReminders().catch((e) => console.warn('[notifications] foreground reschedule failed', e));
        }
      }
    });

    return () => { tapSub.remove(); stateSub.remove(); };
  }, [rescheduleAllReminders]);

  return null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const pendingNavigate = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => setOnboardingDone(val === 'true'))
      .catch(() => setOnboardingDone(true));
  }, []);

  // Startbildschirm: im Onboarding-Pfad ausblenden, sobald es gerendert werden kann (der normale
  // Pfad wartet in SplashGate auf die Notizen). Die Notbremse läuft hier ab Mount — sie greift also
  // auch, wenn Schriften oder Onboarding-Flag hängen. Früher hing das am onLayout der Root-View,
  // das in Expo Go (SDK 54, New Architecture) nicht ankam: Logo blieb für immer stehen.
  useSplashHide(fontsLoaded && onboardingDone === false);

  function handleOnboardingDone(navigateTo?: string) {
    if (navigateTo) pendingNavigate.current = navigateTo;
    AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setOnboardingDone(true);
  }

  if (!fontsLoaded || onboardingDone === null) return null;

  if (!onboardingDone) {
    return (
      <GestureHandlerRootView
        style={{ flex: 1 }}
      >
        <SafeAreaProvider>
          <LanguageProvider>
            <OnboardingScreen
              onDone={() => handleOnboardingDone()}
              onSignup={() => handleOnboardingDone('SettingsKonto')}
              onLogin={() => handleOnboardingDone('SettingsKonto')}
            />
          </LanguageProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <ThemeProvider>
            <PaperProvider theme={AppTheme}>
              <NavigationContainer
                theme={navTheme}
                ref={navigationRef}
                onReady={() => {
                  if (pendingNavigate.current) {
                    (navigationRef as any).navigate(pendingNavigate.current);
                    pendingNavigate.current = null;
                  }
                }}
              >
                <NotesProvider>
                  <ThoughtsProvider>
                    <SplashGate />
                    <NotificationBootstrap />
                    <ReengagementBootstrap />
                    <ShareHandler />
                    <AppNavigator />
                    <StatusBar style="dark" />
                  </ThoughtsProvider>
                </NotesProvider>
              </NavigationContainer>
            </PaperProvider>
          </ThemeProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
