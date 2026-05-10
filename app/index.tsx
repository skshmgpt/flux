import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FluxHeader } from '@/components/flux-header';
import { FluxColorSet, FluxColors, Fonts, Spacing, Typography } from '@/constants/theme';
import { useFluxColors } from '@/hooks/use-flux-colors';
import { useArticleStore } from '@/lib/article-store';
import { playClick } from '@/lib/clicks';
import { useStore } from '@/lib/store';
import type { Feed } from '@/lib/types';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function FeedsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useFluxColors();
  const feeds = useStore((s) => s.feeds);
  const articleMap = useArticleStore((s) => s.articles);
  const feedToUrls = useArticleStore((s) => s.feedToUrls);
  const refreshAllFeeds = useStore((s) => s.refreshAllFeeds);
  const removeFeed = useStore((s) => s.removeFeed);
  const addFeed = useStore((s) => s.addFeed);
  const isRefreshing = useRef(false);

  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const unreadCount = useCallback(
    (feedUrl: string) => {
      const urls = feedToUrls[feedUrl];
      if (!urls) return 0;
      let n = 0;
      for (const u of urls) {
        const a = articleMap[u];
        if (a && !a.isRead) n++;
      }
      return n;
    },
    [feedToUrls, articleMap],
  );

  const handleRefresh = useCallback(async () => {
    isRefreshing.current = true;
    await refreshAllFeeds();
    isRefreshing.current = false;
  }, [refreshAllFeeds]);

  const handleRemove = useCallback(
    (feedUrl: string, title: string) => {
      Alert.alert('Remove feed?', `Remove "${title}" and all its articles?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFeed(feedUrl),
        },
      ]);
    },
    [removeFeed],
  );

  const expand = () => {
    setUrl('');
    setError(null);
    setAdding(true);
  };

  const collapse = () => {
    Keyboard.dismiss();
    setAdding(false);
    setError(null);
  };

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Enter an RSS feed URL');
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      setError('Invalid URL');
      return;
    }

    Keyboard.dismiss();
    setSubmitting(true);
    setError(null);

    try {
      await addFeed(trimmed);
      setUrl('');
      setSubmitting(false);
      setAdding(false);
    } catch (e) {
      setSubmitting(false);
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed: ${msg}`);
    }
  };

  const renderFeed = useCallback(
    ({ item: feed }: { item: Feed }) => {
      const unread = unreadCount(feed.url);
      const isStale = Date.now() - feed.lastFetchedAt > 3600000;

      return (
        <Pressable
          style={({ pressed }) => [
            styles.feedRow,
            pressed && { opacity: 0.5 },
          ]}
          onPress={() => {
            playClick('open');
            router.push(`/feed/${encodeURIComponent(feed.url)}`);
          }}
          onLongPress={() => handleRemove(feed.url, feed.title)}>
          <View style={styles.feedInfo}>
            <Text style={styles.feedTitle} numberOfLines={1}>
              {feed.title}
            </Text>
            <View style={styles.feedMeta}>
              {unread > 0 && (
                <Text style={styles.unreadBadge}>{unread} new</Text>
              )}
              <Text style={styles.feedTimestamp}>
                {timeAgo(feed.lastFetchedAt)}
              </Text>
              {isStale && <View style={styles.staleDot} />}
            </View>
          </View>
        </Pressable>
      );
    },
    [styles, router, unreadCount, handleRemove],
  );

  const addRow = adding ? (
    <Animated.View
      key="expanded"
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(80)}
      style={styles.addExpanded}>
      <TextInput
        style={styles.urlInput}
        value={url}
        onChangeText={(text) => {
          setUrl(text);
          if (error) setError(null);
        }}
        placeholder="https://example.com/feed.xml"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        editable={!submitting}
        autoFocus
      />
      {error && <Text style={styles.urlError}>{error}</Text>}
      <View style={styles.addActions}>
        <Pressable
          onPress={collapse}
          disabled={submitting}
          hitSlop={8}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && { opacity: 0.6 },
          ]}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.subscribeButton,
            pressed && { opacity: 0.7 },
            submitting && { opacity: 0.5 },
          ]}>
          <Text style={styles.subscribeText}>
            {submitting ? '...' : 'Subscribe'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  ) : (
    <Animated.View
      key="collapsed"
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(80)}>
      <Pressable
        onPress={expand}
        style={({ pressed }) => [
          styles.addRow,
          pressed && { opacity: 0.5 },
        ]}>
        <Text style={styles.addRowPlus}>+</Text>
        <Text style={styles.addRowLabel}>Add feed</Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <FluxHeader />
      <FlatList
        data={feeds}
        keyExtractor={(f) => f.url}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.lg }}
        ListHeaderComponent={
          <>
            {addRow}
            <View style={styles.separator} />
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No feeds yet</Text>
            <Text style={styles.emptyHint}>
              Tap &quot;Add feed&quot; above to subscribe to an RSS feed.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={renderFeed}
        maxToRenderPerBatch={15}
        windowSize={5}
        removeClippedSubviews={true}
        initialNumToRender={12}
        refreshing={isRefreshing.current}
        onRefresh={handleRefresh}
      />
    </View>
  );
}

const makeStyles = (c: FluxColorSet) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.h,
      paddingVertical: Spacing.md,
    },
    addRowPlus: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: 20,
      fontWeight: '300',
      color: FluxColors.primary,
      width: 18,
      textAlign: 'center',
    },
    addRowLabel: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      fontWeight: '500',
      color: FluxColors.primary,
    },
    addExpanded: {
      paddingHorizontal: Spacing.h,
      paddingVertical: Spacing.md,
      gap: Spacing.sm,
    },
    urlInput: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      color: c.text,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      backgroundColor: c.surface,
    },
    urlError: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.meta.fontSize,
      color: '#EF4444',
    },
    addActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: Spacing.md,
    },
    cancelButton: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
    },
    cancelText: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      color: c.muted,
    },
    subscribeButton: {
      backgroundColor: FluxColors.primary,
      borderRadius: 8,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      alignItems: 'center',
    },
    subscribeText: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    emptyContainer: {
      paddingHorizontal: Spacing.h,
      paddingVertical: Spacing.lg * 2,
      alignItems: 'center',
    },
    emptyTitle: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.title.fontSize,
      fontWeight: Typography.title.fontWeight,
      color: c.text,
      marginBottom: Spacing.xs,
    },
    emptyHint: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      color: c.muted,
      textAlign: 'center',
    },
    feedRow: {
      paddingHorizontal: Spacing.h,
      paddingVertical: Spacing.md,
    },
    feedInfo: { gap: 6 },
    feedTitle: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      fontWeight: '500',
      color: c.text,
    },
    feedMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    unreadBadge: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.meta.fontSize,
      color: FluxColors.primary,
      fontWeight: '600',
    },
    feedTimestamp: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.meta.fontSize,
      color: c.muted,
    },
    staleDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.muted,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginHorizontal: Spacing.h,
    },
  });
