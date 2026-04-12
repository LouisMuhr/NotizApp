import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import EditorScreen from '../screens/EditorScreen';
import NoteDetailScreen from '../screens/NoteDetailScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ThreadsScreen from '../screens/ThreadsScreen';
import ThreadDetailScreen from '../screens/ThreadDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
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
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="archive-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Einstellungen"
        component={SettingsScreen}
        options={{
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
        options={{ title: 'Notiz' }}
      />
      <Stack.Screen
        name="Editor"
        component={EditorScreen}
        options={{ title: 'Notiz' }}
      />
      <Stack.Screen
        name="ThreadDetail"
        component={ThreadDetailScreen}
        options={({ route }: any) => ({ title: route.params?.title ?? 'Thread' })}
      />
    </Stack.Navigator>
  );
}
