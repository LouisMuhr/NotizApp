import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  Animated,
} from 'react-native';
import { Text, useTheme, ActivityIndicator, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThoughts } from '../context/ThoughtsContext';
import { useNotes } from '../context/NotesContext';
import { Thread } from '../models/Thought';
import { Radii, Shadows, Insets } from '../theme/gradients';
import { Tokens } from '../theme/theme';
import { Type, Fonts } from '../theme/typography';
import { getCategoryAccent } from '../theme/categoryAccents';
import * as haptics from '../utils/haptics';
import { getSupabase } from '../sync/supabaseClient';
import ProBanner from '../components/ProBanner';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  navigation: any;
}

function formatRelativeTime(iso: string, t: ReturnType<typeof useLanguage>['t']): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return t('threads.relativeJustNow');
  if (minutes < 60) return t('threads.relativeMinutesAgo', { count: minutes });
  if (hours < 24) return t('threads.relativeHoursAgo', { count: hours });
  if (days === 1) return t('threads.relativeYesterday');
  return t('threads.relativeDaysAgo', { count: days });
}

interface ThreadCardProps {
  thread: Thread;
  index: number;
  newCount: number;
  onPress: () => void;
  onArchive: () => void;
  onPin: () => void;
  onUnpin: () => void;
}

function ThreadCard({ thread, index, newCount, onPress, onArchive, onPin, onUnpin }: ThreadCardProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const swipeableRef = useRef<Swipeable>(null);
  const accent = getCategoryAccent(thread.title);

  const lastUpdated = formatRelativeTime(thread.updatedAt, t);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.swipeAction, styles.archiveAction, { backgroundColor: Tokens.amberSoft }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons name="archive-outline" size={26} color={Tokens.amberDeep} />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: Tokens.amberDeep }]}>
          {t('threads.swipeArchive')}
        </Text>
      </View>
    );
  };

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.swipeAction, styles.pinAction, { backgroundColor: Tokens.paperDeep }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialCommunityIcons
            name={thread.isPinned ? 'pin-off-outline' : 'pin-outline'}
            size={26}
            color={Tokens.ink}
          />
        </Animated.View>
        <Text style={[styles.swipeLabel, { color: Tokens.ink }]}>
          {thread.isPinned ? t('threads.swipeUnpin') : t('threads.swipePin')}
        </Text>
      </View>
    );
  };

  const handleSwipeRight = () => {
    swipeableRef.current?.close();
    haptics.medium();
    onArchive();
  };

  const handleSwipeLeft = () => {
    swipeableRef.current?.close();
    haptics.medium();
    if (thread.isPinned) {
      onUnpin();
    } else {
      onPin();
    }
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') handleSwipeRight();
        if (direction === 'left') handleSwipeLeft();
      }}
      overshootRight={false}
      overshootLeft={false}
      containerStyle={styles.swipeContainer}
    >
      <Pressable
        onPress={() => {
          haptics.light();
          onPress();
        }}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}
      >
        <View style={[styles.card, Insets.cardBorder, Shadows.softWarm]}>
          {/* Accent-Streifen links */}
          <View style={[styles.accentBar, { backgroundColor: accent.soft }]} />

          <View style={styles.cardContent}>
            {/* Header row */}
            <View style={styles.cardHeader}>
              {thread.isPinned && (
                <MaterialCommunityIcons
                  name="pin"
                  size={14}
                  color={Tokens.amberDeep}
                  style={styles.pinIcon}
                />
              )}
              <Text style={styles.threadTitle} numberOfLines={1}>
                {thread.title}
              </Text>
              {newCount > 0 && (
                <View style={[styles.badge, { backgroundColor: Tokens.amberSoft }]}>
                  <Text style={[styles.badgeText, { color: Tokens.amberDeep }]}>{t('threads.newBadge', { count: newCount })}</Text>
                </View>
              )}
              <MaterialCommunityIcons name="creation" size={14} color={Tokens.amber} />
            </View>

            {/* Summary preview */}
            {thread.summary ? (
              <Text style={styles.summary} numberOfLines={2}>
                {thread.summary}
              </Text>
            ) : (
              <Text style={styles.summaryEmpty}>
                {t('threads.noSummary')}
              </Text>
            )}

            {/* Footer row */}
            <View style={styles.cardFooter}>
              <MaterialCommunityIcons
                name="thought-bubble-outline"
                size={13}
                color={Tokens.inkFaint}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.metaText}>
                {t('threadDetail.noteCount', { count: thread.noteCount })}
              </Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{lastUpdated}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const BRIDGE_URL = process.env.EXPO_PUBLIC_BRIDGE_URL ?? '';

async function runSynthesis(t: ReturnType<typeof useLanguage>['t']): Promise<{ message: string; next_allowed_at?: string }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error(t('threads.syncNotConfigured'));
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(t('threads.notSignedIn'));

  const res = await fetch(`${BRIDGE_URL}/api/synthesize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  });

  const json = await res.json();

  if (res.status === 429) {
    return { message: 'limit_reached', next_allowed_at: json?.next_allowed_at };
  }

  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  if (json.message === 'no_feed_notes') return { message: t('threads.noNewNotes') };
  const created = json.threads_created ?? 0;
  const updated = json.threads_updated ?? 0;
  const parts: string[] = [];
  if (created > 0) parts.push(t('threads.threadsCreated', { count: created }));
  if (updated > 0) parts.push(t('threads.threadsUpdated', { count: updated }));
  return { message: parts.length > 0 ? parts.join(', ') : t('threads.nothingNew') };
}

/** Formats a Date into a localized short date: "Mo. 26. Mai" / "Mon, May 26" */
function formatLocalizedDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
}

/** Calculates days until a future date (ceil) */
function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export default function ThreadsScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t, locale } = useLanguage();
  const { threads, loading, archiveThread, pinThread, unpinThread } = useThoughts();
  const { nextAllowedAt, refreshSubscription } = useNotes();
  const [synthesizing, setSynthesizing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  // Is the user currently rate-limited?
  const isLimited = nextAllowedAt !== null && nextAllowedAt > new Date();

  function getSynthesizeLabel(): string {
    if (synthesizing) return t('threads.synthesizeRunning');
    if (isLimited) {
      const days = daysUntil(nextAllowedAt!);
      return t('threads.synthesizeAvailableIn', { count: days });
    }
    return t('threads.synthesize');
  }

  async function handleSynthesize() {
    if (isLimited) return; // shouldn't happen since button is disabled
    haptics.medium();
    setSynthesizing(true);
    try {
      const result = await runSynthesis(t);
      if (result.message === 'limit_reached' && result.next_allowed_at) {
        // Server says we're limited — refresh subscription state
        await refreshSubscription();
        const nextDate = new Date(result.next_allowed_at);
        setSnackMessage(`${t('threads.limitReached')}${formatLocalizedDate(nextDate, locale)}`);
      } else {
        // On success, also refresh (ai_last_run was updated server-side)
        await refreshSubscription();
        setSnackMessage(result.message);
      }
    } catch (e: any) {
      setSnackMessage(t('threads.errorPrefix') + (e?.message ?? 'Unbekannt'));
    } finally {
      setSynthesizing(false);
      setSnackVisible(true);
    }
  }

  const activeThreads = threads
    .filter((t) => t.status === 'active')
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const newCountByThread: Record<string, number> = {};

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerEyebrow}>
              {activeThreads.length === 0 ? t('threads.emptyEyebrow') : t('threads.activeCount', { count: activeThreads.length })}
            </Text>
            <Text style={styles.headerTitle}>{t('threads.title')}</Text>
          </View>
          <Pressable
            onPress={handleSynthesize}
            disabled={synthesizing || isLimited}
            style={({ pressed }) => [
              styles.synthesizeBtn,
              isLimited && styles.synthesizeBtnDisabled,
              !isLimited && pressed && styles.synthesizeBtnPressed,
            ]}
          >
            {synthesizing ? (
              <ActivityIndicator size={16} color={isLimited ? Tokens.inkFaint : Tokens.amberDeep} style={{ marginRight: 6 }} />
            ) : (
              <MaterialCommunityIcons
                name={isLimited ? 'clock-outline' : 'creation'}
                size={16}
                color={isLimited ? Tokens.inkFaint : Tokens.amberDeep}
                style={{ marginRight: 6 }}
              />
            )}
            <Text style={[styles.synthesizeBtnText, isLimited && styles.synthesizeBtnTextDisabled]}>
              {getSynthesizeLabel()}
            </Text>
          </Pressable>
        </View>
      </View>

      <ProBanner onPress={() => navigation.navigate('SettingsAbo')} />

      {activeThreads.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: Tokens.amberSoft }]}>
            <MaterialCommunityIcons name="creation" size={48} color={Tokens.amberDeep} />
          </View>
          <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            {t('threads.emptyTitle')}
          </Text>
          <Text variant="bodySmall" style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {t('threads.emptyHint')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeThreads}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ThreadCard
              thread={item}
              index={index}
              newCount={newCountByThread[item.id] ?? 0}
              onPress={() => navigation.navigate('ThreadDetail', { threadId: item.id, title: item.title })}
              onArchive={() => archiveThread(item.id)}
              onPin={() => pinThread(item.id)}
              onUnpin={() => unpinThread(item.id)}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={3500}
        style={{ backgroundColor: Tokens.ink }}
        action={{ label: t('threads.snackbarOk'), onPress: () => setSnackVisible(false), textColor: Tokens.amber }}
      >
        <Text style={{ color: Tokens.paper, fontFamily: Fonts.sans, fontSize: 13 }}>{snackMessage}</Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  synthesizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Tokens.amberSoft,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  synthesizeBtnPressed: {
    opacity: 0.75,
  },
  synthesizeBtnDisabled: {
    backgroundColor: Tokens.inkFaint + '18', // very faint bg
  },
  synthesizeBtnText: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 13,
    color: Tokens.amberDeep,
  },
  synthesizeBtnTextDisabled: {
    color: Tokens.inkFaint,
  },
  headerEyebrow: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    color: Tokens.inkFaint,
    marginBottom: 2,
  },
  headerTitle: {
    ...Type.h1,
    color: Tokens.ink,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 22,
    textAlign: 'center',
    fontFamily: Fonts.serif,
  },
  emptySubtitle: {
    marginTop: 6,
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 20,
  },
  list: {
    paddingTop: 12,
  },
  separator: {
    height: 8,
  },
  swipeContainer: {
    marginHorizontal: 16,
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 92,
  },
  archiveAction: {
    borderTopRightRadius: Radii.lg,
    borderBottomRightRadius: Radii.lg,
  },
  pinAction: {
    borderTopLeftRadius: Radii.lg,
    borderBottomLeftRadius: Radii.lg,
  },
  swipeLabel: {
    fontSize: 10,
    fontFamily: Fonts.sansSemibold,
    marginTop: 4,
  },
  cardPressable: {
    borderRadius: Radii.lg,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: Radii.lg,
    backgroundColor: Tokens.paperDeep,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinIcon: {
    marginRight: -2,
  },
  threadTitle: {
    flex: 1,
    ...Type.noteTitle,
    color: Tokens.ink,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: Fonts.sansSemibold,
    fontSize: 11,
  },
  summary: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Tokens.inkDim,
  },
  summaryEmpty: {
    fontFamily: Fonts.serifItalic,
    fontSize: 13,
    color: Tokens.inkFaint,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Tokens.inkFaint,
  },
  metaDot: {
    marginHorizontal: 5,
    color: Tokens.inkFaint,
    opacity: 0.4,
  },
});
