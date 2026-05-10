import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import RenderHtml, { MixedStyleDeclaration } from 'react-native-render-html';

import { FluxHeader } from '@/components/flux-header';
import { FluxColorSet, FluxColors, Fonts, Spacing, Typography } from '@/constants/theme';
import { useFluxColors } from '@/hooks/use-flux-colors';
import { useArticleStore } from '@/lib/article-store';
import { getCachedBody } from '@/lib/cache';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
}

// Split body HTML into block-level chunks so each one can be parsed by
// react-native-render-html only when its FlatList row mounts. This keeps
// the JS thread free for taps/scroll: top chunks render immediately,
// the rest stream in as the user scrolls.
function splitHtmlBlocks(html: string): string[] {
  const splitter = /<\/(p|h[1-6]|blockquote|pre|ul|ol|figure|table|div)>/gi;
  const out: string[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = splitter.exec(html)) !== null) {
    const end = m.index + m[0].length;
    const chunk = html.slice(lastIdx, end).trim();
    if (chunk) out.push(chunk);
    lastIdx = end;
  }
  if (lastIdx < html.length) {
    const tail = html.slice(lastIdx).trim();
    if (tail) out.push(tail);
  }
  // If splitter found nothing (pure inline HTML), fall back to one chunk.
  if (out.length === 0 && html.trim()) out.push(html);
  return out;
}

interface ChunkRendererProps {
  html: string;
  contentWidth: number;
  baseStyle: MixedStyleDeclaration;
  tagsStyles: Record<string, MixedStyleDeclaration>;
  systemFonts: string[];
  renderersProps: Record<string, unknown>;
}

const ArticleChunk = memo(function ArticleChunk(props: ChunkRendererProps) {
  return (
    <RenderHtml
      contentWidth={props.contentWidth}
      source={{ html: props.html }}
      baseStyle={props.baseStyle}
      systemFonts={props.systemFonts}
      tagsStyles={props.tagsStyles}
      renderersProps={props.renderersProps}
    />
  );
});

export default function ArticleScreen() {
  const { url: encodedUrl, feedUrl: encodedFeedUrl } =
    useLocalSearchParams<{ url: string; feedUrl: string }>();
  const articleUrl = decodeURIComponent(encodedUrl);
  const feedUrl = decodeURIComponent(encodedFeedUrl);
  const { width } = useWindowDimensions();
  const colors = useFluxColors();
  const markTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct O(1) lookup; this subscriber only re-renders when *this* article
  // mutates, not when any other article in the store changes.
  const article = useArticleStore((s) => s.articles[articleUrl]);
  const toggleRead = useArticleStore((s) => s.toggleRead);
  const ensureBody = useArticleStore((s) => s.ensureBody);

  // null = still resolving, '' = resolved with no body, else HTML
  const [body, setBody] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const contentWidth = width - Spacing.h * 2;

  // Defer the color propagation into RenderHtml chunks. When the theme
  // toggles, the rest of the UI updates synchronously (header, borders,
  // title), but the expensive HTML re-parse happens on a low-priority
  // commit — masked by the 150ms ThemeTransition overlay. This is what
  // actually keeps theme toggles snappy on long articles.
  const deferredColors = useDeferredValue(colors);

  const baseStyle: MixedStyleDeclaration = useMemo(
    () => ({
      fontFamily: Fonts?.serif ?? 'serif',
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: deferredColors.text,
    }),
    [deferredColors],
  );

  const tagsStyles = useMemo(
    () => ({
      a: { color: FluxColors.primary, textDecorationLine: 'underline' as const },
      img: { maxWidth: contentWidth },
      blockquote: {
        borderLeftWidth: 2,
        borderLeftColor: FluxColors.primary,
        paddingLeft: Spacing.md,
        marginLeft: 0,
        marginBottom: Spacing.md,
        opacity: 0.85,
      },
      code: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 13,
        backgroundColor: deferredColors.surface,
        paddingHorizontal: 4,
        borderRadius: 3,
      },
      pre: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 13,
        lineHeight: 20,
        backgroundColor: deferredColors.surface,
        padding: Spacing.md,
        borderRadius: 8,
        marginBottom: Spacing.md,
        overflow: 'hidden' as const,
      },
      h1: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 22, fontWeight: '700' as const, color: deferredColors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm, lineHeight: 30 },
      h2: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 19, fontWeight: '600' as const, color: deferredColors.text, marginTop: Spacing.md, marginBottom: Spacing.sm, lineHeight: 26 },
      h3: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 17, fontWeight: '600' as const, color: deferredColors.text, marginTop: Spacing.md, marginBottom: Spacing.xs, lineHeight: 24 },
      h4: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 15, fontWeight: '600' as const, color: deferredColors.text, marginTop: Spacing.md, marginBottom: Spacing.xs, lineHeight: 22 },
      h5: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 14, fontWeight: '600' as const, color: deferredColors.muted, marginTop: Spacing.sm, marginBottom: Spacing.xs, lineHeight: 20 },
      h6: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 13, fontWeight: '600' as const, color: deferredColors.muted, marginTop: Spacing.sm, marginBottom: Spacing.xs, lineHeight: 18 },
      p: { marginBottom: Spacing.md, lineHeight: Typography.body.lineHeight },
      ul: { marginBottom: Spacing.md, paddingLeft: Spacing.md },
      ol: { marginBottom: Spacing.md, paddingLeft: Spacing.md },
      li: { marginBottom: 4, lineHeight: Typography.body.lineHeight },
      hr: { height: StyleSheet.hairlineWidth, backgroundColor: deferredColors.border, marginVertical: Spacing.md, borderWidth: 0 },
      figure: { marginBottom: Spacing.md, marginLeft: 0, marginRight: 0 },
      figcaption: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 12, color: deferredColors.muted, marginTop: 4, textAlign: 'center' as const },
      table: { marginBottom: Spacing.md, borderWidth: 1, borderColor: deferredColors.border, borderRadius: 4 },
      th: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 13, fontWeight: '600' as const, color: deferredColors.text, backgroundColor: deferredColors.surface, padding: 8, borderBottomWidth: 1, borderBottomColor: deferredColors.border },
      td: { padding: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: deferredColors.border, lineHeight: Typography.body.lineHeight },
      strong: { fontWeight: '700' as const },
      em: { fontStyle: 'italic' as const },
    }),
    [deferredColors, contentWidth],
  );

  const systemFonts = useMemo(
    () => [
      ...(Fonts?.mono ? [Fonts.mono] : []),
      ...(Fonts?.serif ? [Fonts.serif] : []),
    ],
    [],
  );

  const renderersProps = useMemo(
    () => ({
      a: {
        onPress: (_e: unknown, href: string) => {
          if (href) WebBrowser.openBrowserAsync(href).catch(() => {});
        },
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await getCachedBody(articleUrl);
      if (cancelled) return;
      if (cached) {
        setBody(cached);
        return;
      }
      try {
        const html = await ensureBody(articleUrl, feedUrl);
        if (!cancelled) setBody(html || '');
      } catch {
        if (!cancelled) setBody('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [articleUrl, feedUrl, ensureBody]);

  // Auto-mark read after 300ms on screen
  useEffect(() => {
    if (article && !article.isRead) {
      markTimer.current = setTimeout(() => {
        toggleRead(articleUrl);
      }, 300);
    }
    return () => {
      if (markTimer.current) clearTimeout(markTimer.current);
    };
  }, [articleUrl, article, toggleRead]);

  const chunks = useMemo(() => (body ? splitHtmlBlocks(body) : []), [body]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <ArticleChunk
        html={item}
        contentWidth={contentWidth}
        baseStyle={baseStyle}
        tagsStyles={tagsStyles}
        systemFonts={systemFonts}
        renderersProps={renderersProps}
      />
    ),
    [contentWidth, baseStyle, tagsStyles, systemFonts, renderersProps],
  );

  const ListHeader = useMemo(
    () =>
      article ? (
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{article.title}</Text>
          <View style={styles.metaRow}>
            {article.author ? <Text style={styles.meta}>{article.author}</Text> : null}
            {article.author ? <Text style={styles.meta}> · </Text> : null}
            <Text style={styles.meta}>{formatDate(article.publishedAt)}</Text>
          </View>
          <View style={styles.rule} />
          <Pressable style={styles.toggleRead} onPress={() => toggleRead(articleUrl)}>
            <Text style={styles.toggleReadText}>
              {article.isRead ? 'Mark unread' : 'Mark read'}
            </Text>
          </Pressable>
        </View>
      ) : null,
    [article, styles, toggleRead, articleUrl],
  );

  if (!article) {
    return (
      <View style={styles.container}>
        <FluxHeader showBack />
        <Text style={styles.errorText}>Article not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FluxHeader showBack />
      <FlatList
        data={chunks}
        keyExtractor={(_, i) => `chunk-${i}`}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          body === null ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.muted} />
            </View>
          ) : (
            <View style={styles.loading}>
              <Text style={styles.errorText}>Body not available.</Text>
              <Pressable
                style={styles.openButton}
                onPress={() =>
                  WebBrowser.openBrowserAsync(articleUrl).catch(() => {})
                }>
                <Text style={styles.openButtonText}>Open original</Text>
              </Pressable>
            </View>
          )
        }
        contentContainerStyle={styles.content}
        // Progressive rendering tunables — keep first paint cheap, fill in
        // off-screen chunks as the user scrolls.
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews
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
    content: {
      paddingHorizontal: Spacing.h,
      paddingBottom: Spacing.lg * 2,
    },
    headerBlock: {
      paddingTop: Spacing.sm,
    },
    title: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.title.fontSize,
      fontWeight: Typography.title.fontWeight,
      color: c.text,
      marginBottom: Spacing.xs,
      lineHeight: Typography.title.lineHeight,
    },
    metaRow: {
      flexDirection: 'row',
      marginBottom: Spacing.md,
    },
    meta: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.meta.fontSize,
      color: c.muted,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginBottom: Spacing.md,
    },
    toggleRead: {
      alignSelf: 'flex-end',
      marginBottom: Spacing.md,
    },
    toggleReadText: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.meta.fontSize,
      color: c.muted,
    },
    loading: {
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      gap: Spacing.md,
    },
    errorText: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      color: c.muted,
      textAlign: 'center',
    },
    openButton: {
      backgroundColor: FluxColors.primary,
      borderRadius: 8,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    openButtonText: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
