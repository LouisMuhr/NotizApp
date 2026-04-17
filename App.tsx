import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { ThemeProvider } from './src/context/ThemeContext';
import { NotesProvider } from './src/context/NotesContext';
import { ThoughtsProvider } from './src/context/ThoughtsContext';
import { AppTheme } from './src/theme/theme';
import AppNavigator from './src/navigation/AppNavigator';
import ShareHandler from './src/components/ShareHandler';
import { requestNotificationPermissions } from './src/utils/notifications';
import { useNotes } from './src/context/NotesContext';
import { LogBox } from 'react-native';
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: AppTheme.colors.background,
    card: AppTheme.colors.surface,
    text: AppTheme.colors.onSurface,
    primary: AppTheme.colors.primary,
    border: AppTheme.colors.outline,
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
                  <StatusBar style="light" />
                </ThoughtsProvider>
              </NotesProvider>
            </NavigationContainer>
          </PaperProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
