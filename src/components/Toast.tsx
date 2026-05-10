import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tokens } from '../theme/theme';
import { Fonts } from '../theme/typography';

interface ToastProps {
  visible: boolean;
  message: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

export default function Toast({ visible, message, icon = 'check-circle-outline' }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 8, duration: 140, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.pill}>
        <MaterialCommunityIcons name={icon} size={16} color={Tokens.paper} style={styles.icon} />
        <Text style={styles.label}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Tokens.ink,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
    shadowColor: Tokens.warmShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  icon: {
    opacity: 0.85,
  },
  label: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: Tokens.paper,
    letterSpacing: 0.1,
  },
});
