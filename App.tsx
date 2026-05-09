import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
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
import { NotesProvider } from './src/context/NotesContext';
import { ThoughtsProvider } from './src/context/ThoughtsContext';
import { AppTheme, Tokens } from './src/theme/theme';
import AppNavigator from './src/navigation/AppNavigator';
import ShareHandler from './src/components/ShareHandler';
import OnboardingScreen, { ONBOARDING_KEY } from './src/screens/onboarding';
import { requestNotificationPermissions } from './src/utils/notifications';
import { useNotes } from './src/context/NotesContext';
import { LogBox } from 'react-native';
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

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

export const navigationRef = createNavigationContainerRef();

function NotificationBootstrap() {
  const { rescheduleAllReminders } = useNotes();
  const appState = useRef(AppState.currentState);
  const lastReschedule = useRef(0);

  useEffect(() => {
    requestNotificationPermissions();

    function handleTap(response: Notifications.NotificationResponse) {
      const noteId = response.notification.request.content.data?.noteId as string | undefined;
      if (!noteId) return;
      const tryNav = () => {
        if (navigationRef.isReady()) { (navigationRef as any).navigate('NoteDetail', { noteId }); }
        else { setTimeout(tryNav, 100); }
      };
      tryNav();
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
    Inter_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    // TODO: Zeile unten entfernen nach dem Testen
    AsyncStorage.removeItem(ONBOARDING_KEY).then(() => {
      AsyncStorage.getItem(ONBOARDING_KEY).then((val) => setOnboardingDone(val === 'true'));
    });
  }, []);

  if (!fontsLoaded || onboardingDone === null) return null;

  if (!onboardingDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <OnboardingScreen onDone={() => setOnboardingDone(true)} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PaperProvider theme={AppTheme}>
            <NavigationContainer theme={navTheme} ref={navigationRef}>
              <NotesProvider>
                <ThoughtsProvider>
                  <NotificationBootstrap />
                  <ShareHandler />
                  <AppNavigator />
                  <StatusBar style="dark" />
                </ThoughtsProvider>
              </NotesProvider>
            </NavigationContainer>
          </PaperProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
