import { useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FluxColorSet, FluxColors, Fonts, Spacing, Typography } from '@/constants/theme';
import { useFluxColors } from '@/hooks/use-flux-colors';
import { useArticleStore } from '@/lib/article-store';
import { search } from '@/lib/fuzzy';
import { useStore } from '@/lib/store';
import type { Article } from '@/lib/types';

interface SearchResult {
  article: Article;
  feedTitle: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useFluxColors();
  const articleMap = useArticleStore((s) => s.articles);
  const feeds = useStore((s) => s.feeds);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const feedTitleMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of feeds) m[f.url] = f.title;
    return m;
  }, [feeds]);

  const allArticles = useMemo(() => {
    return Object.values(articleMap).filter((a) => a.title);
  }, [articleMap]);

  const results: SearchResult[] = useMemo(() => {
    if (!deferredQuery.trim()) return [];
    const matched = search(deferredQuery, allArticles, (a) => a.title, 30);
    return matched.map((a) => ({
      article: a,
      feedTitle: feedTitleMap[a.feedUrl] || a.feedUrl,
    }));
  }, [deferredQuery, allArticles, feedTitleMap]);

  const handlePress = useCallback(
    (article: Article) => {
      router.push(
        `/article/${encodeURIComponent(article.url)}?feedUrl=${encodeURIComponent(article.feedUrl)}`,
      );
    },
    [router],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    router.back();
  }, [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search articles..."
          placeholderTextColor={colors.muted}
          autoFocus
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={handleClear} hitSlop={8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      {deferredQuery.trim() && results.length === 0 && (
        <Text style={styles.emptyText}>No results</Text>
      )}

      {!deferredQuery.trim() && (
        <Text style={styles.hint}>
          Search across {allArticles.length} articles from {feeds.length} feeds
        </Text>
      )}

      <Animated.FlatList
        data={results}
        keyExtractor={(item) => item.article.url}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.duration(120).delay(index * 20)}
            exiting={FadeOutUp.duration(80)}>
            <Pressable
              style={({ pressed }) => [
                styles.resultRow,
                pressed && { opacity: 0.5 },
              ]}
              onPress={() => handlePress(item.article)}>
              <Text style={styles.resultTitle} numberOfLines={2}>
                {item.article.title}
              </Text>
              <View style={styles.resultMeta}>
                <Text style={styles.resultFeed} numberOfLines={1}>
                  {item.feedTitle}
                </Text>
                <Text style={styles.resultDate}>
                  {formatDate(item.article.publishedAt)}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
        maxToRenderPerBatch={15}
        windowSize={5}
        removeClippedSubviews={true}
        initialNumToRender={12}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.h,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    input: {
      flex: 1,
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      color: c.text,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      backgroundColor: c.surface,
      borderRadius: 8,
    },
    cancelText: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      color: FluxColors.primary,
    },
    listContent: {
      paddingBottom: Spacing.lg,
    },
    resultRow: {
      paddingHorizontal: Spacing.h,
      paddingVertical: Spacing.md,
    },
    resultTitle: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      fontWeight: '500',
      color: c.text,
      marginBottom: 4,
    },
    resultMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    resultFeed: {
      flex: 1,
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.meta.fontSize,
      color: FluxColors.primary,
    },
    resultDate: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.meta.fontSize,
      color: c.muted,
    },
    emptyText: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      color: c.muted,
      textAlign: 'center',
      paddingTop: Spacing.lg * 2,
    },
    hint: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.meta.fontSize,
      color: c.muted,
      textAlign: 'center',
      paddingTop: Spacing.lg * 2,
      paddingHorizontal: Spacing.h,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginHorizontal: Spacing.h,
    },
  });
