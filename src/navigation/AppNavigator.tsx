import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as haptics from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';
import HomeScreen from '../screens/HomeScreen';
import EditorScreen from '../screens/EditorScreen';
import NoteDetailScreen from '../screens/NoteDetailScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ThreadsScreen from '../screens/ThreadsScreen';
import ThreadDetailScreen from '../screens/ThreadDetailScreen';
import SettingsDarstellungScreen from '../screens/SettingsDarstellungScreen';
import SettingsKategorienScreen from '../screens/SettingsKategorienScreen';
import SettingsBenachrichtigungenScreen from '../screens/SettingsBenachrichtigungenScreen';
import SettingsSynchronisationScreen from '../screens/SettingsSynchronisationScreen';
import SettingsKontoScreen from '../screens/SettingsKontoScreen';
import SettingsDatenschutzScreen from '../screens/SettingsDatenschutzScreen';
import SettingsBookmarkletScreen from '../screens/SettingsBookmarkletScreen';
import SettingsAboScreen from '../screens/SettingsAboScreen';
import SettingsWebAppScreen from '../screens/SettingsWebAppScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => { haptics.tap(); },
      }}
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Threads"
        component={ThreadsScreen}
        options={{
          headerShown: false,
          tabBarLabel: t('navigation.threads'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="thought-bubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Notizen"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarLabel: t('navigation.notes'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="note-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Archiv"
        component={ArchiveScreen}
        options={{
          headerShown: false,
          tabBarLabel: t('navigation.archive'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="archive-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Einstellungen"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('navigation.settings'),
          title: t('navigation.settings'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const theme = useTheme();
  const { t } = useLanguage();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NoteDetail"
        component={NoteDetailScreen}
        options={{ title: t('navigation.note') }}
      />
      <Stack.Screen
        name="Editor"
        component={EditorScreen}
        options={{ title: t('navigation.note') }}
      />
      <Stack.Screen
        name="ThreadDetail"
        component={ThreadDetailScreen}
        options={({ route }: any) => ({ title: route.params?.title ?? t('navigation.thread') })}
      />
      <Stack.Screen
        name="SettingsDarstellung"
        component={SettingsDarstellungScreen}
        options={{ title: t('navigation.appearance') }}
      />
      <Stack.Screen
        name="SettingsKategorien"
        component={SettingsKategorienScreen}
        options={{ title: t('navigation.categories') }}
      />
      <Stack.Screen
        name="SettingsBenachrichtigungen"
        component={SettingsBenachrichtigungenScreen}
        options={{ title: t('navigation.notifications') }}
      />
      <Stack.Screen
        name="SettingsSynchronisation"
        component={SettingsSynchronisationScreen}
        options={{ title: t('navigation.sync') }}
      />
      <Stack.Screen
        name="SettingsKonto"
        component={SettingsKontoScreen}
        options={{ title: t('navigation.account') }}
      />
      <Stack.Screen
        name="SettingsDatenschutz"
        component={SettingsDatenschutzScreen}
        options={{ title: t('navigation.privacy') }}
      />
      <Stack.Screen
        name="SettingsBookmarklet"
        component={SettingsBookmarkletScreen}
        options={{ title: t('navigation.bookmarklet') }}
      />
      <Stack.Screen
        name="SettingsAbo"
        component={SettingsAboScreen}
        options={{ title: t('navigation.subscription') }}
      />
      <Stack.Screen
        name="SettingsWebApp"
        component={SettingsWebAppScreen}
        options={{ title: t('navigation.webApp') }}
      />
    </Stack.Navigator>
  );
}
