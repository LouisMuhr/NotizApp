import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/context/ThemeContext';
import { NotesProvider } from './src/context/NotesContext';
import { ThoughtsProvider } from './src/context/ThoughtsContext';
import { AppTheme } from './src/theme/theme';
import AppNavigator from './src/navigation/AppNavigator';
import { requestNotificationPermissions } from './src/utils/notifications';
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

export default function App() {
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PaperProvider theme={AppTheme}>
            <NavigationContainer theme={navTheme}>
              <NotesProvider>
                <ThoughtsProvider>
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
