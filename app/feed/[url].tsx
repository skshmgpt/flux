import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { FluxHeader } from '@/components/flux-header';
import { FluxColorSet, FluxColors, Fonts, Spacing, Typography } from '@/constants/theme';
import { useFluxColors } from '@/hooks/use-flux-colors';
import { playClick } from '@/lib/clicks';
import { useStore } from '@/lib/store';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
}

export default function FeedArticlesScreen() {
  const { url: encodedUrl } = useLocalSearchParams<{ url: string }>();
  const feedUrl = decodeURIComponent(encodedUrl);
  const router = useRouter();
  const colors = useFluxColors();

  const allArticles = useStore((s) => s.articles);
  const refreshFeed = useStore((s) => s.refreshFeed);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const sorted = useMemo(
    () =>
      allArticles
        .filter((a) => a.feedUrl === feedUrl)
        .sort((a, b) => {
          const da = new Date(a.publishedAt).getTime();
          const db = new Date(b.publishedAt).getTime();
          if (isNaN(da) && isNaN(db)) return 0;
          if (isNaN(da)) return 1;
          if (isNaN(db)) return -1;
          return db - da;
        }),
    [allArticles, feedUrl],
  );

  const handleRefresh = useCallback(async () => {
    await refreshFeed(feedUrl);
  }, [refreshFeed, feedUrl]);

  return (
    <View style={styles.screen}>
      <FluxHeader showBack />
      <FlatList
        data={sorted}
        keyExtractor={(a) => a.url}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item: article }) => (
          <Pressable
            style={({ pressed }) => [
              styles.articleRow,
              pressed && { opacity: 0.5 },
            ]}
            onPress={() => {
              playClick('openHigh');
              router.push(
                `/article/${encodeURIComponent(article.url)}?feedUrl=${encodeURIComponent(feedUrl)}`,
              );
            }}>
            <View style={styles.articleInfo}>
              <View style={styles.titleRow}>
                {!article.isRead && <View style={styles.unreadDot} />}
                <Text style={styles.articleTitle} numberOfLines={2}>
                  {article.title}
                </Text>
              </View>
              <Text style={styles.articleMeta}>
                {article.author ? `${article.author} · ` : ''}
                {formatDate(article.publishedAt)}
              </Text>
            </View>
          </Pressable>
        )}
        refreshing={false}
        onRefresh={handleRefresh}
      />
    </View>
  );
}

const makeStyles = (c: FluxColorSet) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.bg,
    },
    content: {
      paddingBottom: Spacing.lg,
      backgroundColor: c.bg,
    },
    articleRow: {
      paddingHorizontal: Spacing.h,
      paddingVertical: Spacing.md,
    },
    articleInfo: { gap: 4 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: FluxColors.primary,
      marginTop: 7,
    },
    articleTitle: {
      flex: 1,
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      fontWeight: '500',
      color: c.text,
      lineHeight: Typography.label.lineHeight,
    },
    articleMeta: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.meta.fontSize,
      color: c.muted,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginHorizontal: Spacing.h,
    },
  });
