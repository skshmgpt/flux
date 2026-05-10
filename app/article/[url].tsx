import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Pressable,
  ScrollView,
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
import { useThemeStore } from '@/lib/theme-store';

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
  if (out.length === 0 && html.trim()) out.push(html);
  return out;
}

function makeBaseStyle(c: FluxColorSet): MixedStyleDeclaration {
  return {
    fontFamily: Fonts?.serif ?? 'serif',
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    color: c.text,
  };
}

function makeTagsStyles(c: FluxColorSet, contentWidth: number): Record<string, MixedStyleDeclaration> {
  return {
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
      backgroundColor: c.surface,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    pre: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: 13,
      lineHeight: 20,
      backgroundColor: c.surface,
      padding: Spacing.md,
      borderRadius: 8,
      marginBottom: Spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: FluxColors.primary,
    },
    h1: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 22, fontWeight: '700' as const, color: c.text, marginTop: Spacing.lg, marginBottom: Spacing.sm, lineHeight: 30 },
    h2: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 19, fontWeight: '600' as const, color: c.text, marginTop: Spacing.md, marginBottom: Spacing.sm, lineHeight: 26 },
    h3: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 17, fontWeight: '600' as const, color: c.text, marginTop: Spacing.md, marginBottom: Spacing.xs, lineHeight: 24 },
    h4: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 15, fontWeight: '600' as const, color: c.text, marginTop: Spacing.md, marginBottom: Spacing.xs, lineHeight: 22 },
    h5: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 14, fontWeight: '600' as const, color: c.muted, marginTop: Spacing.sm, marginBottom: Spacing.xs, lineHeight: 20 },
    h6: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 13, fontWeight: '600' as const, color: c.muted, marginTop: Spacing.sm, marginBottom: Spacing.xs, lineHeight: 18 },
    p: { marginBottom: Spacing.md, lineHeight: Typography.body.lineHeight },
    ul: { marginBottom: Spacing.md, paddingLeft: Spacing.md },
    ol: { marginBottom: Spacing.md, paddingLeft: Spacing.md },
    li: { marginBottom: 4, lineHeight: Typography.body.lineHeight },
    hr: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: Spacing.md, borderWidth: 0 },
    figure: { marginBottom: Spacing.md, marginLeft: 0, marginRight: 0 },
    figcaption: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 12, color: c.muted, marginTop: 4, textAlign: 'center' as const },
    table: { marginBottom: Spacing.md, borderWidth: 1, borderColor: c.border, borderRadius: 4 },
    th: { fontFamily: Fonts?.mono ?? 'monospace', fontSize: 13, fontWeight: '600' as const, color: c.text, backgroundColor: c.surface, padding: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    td: { padding: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, lineHeight: Typography.body.lineHeight },
    strong: { fontWeight: '700' as const },
    em: { fontStyle: 'italic' as const },
  };
}

interface ChunkRendererProps {
  html: string;
  contentWidth: number;
  lightBaseStyle: MixedStyleDeclaration;
  darkBaseStyle: MixedStyleDeclaration;
  lightTagsStyles: Record<string, MixedStyleDeclaration>;
  darkTagsStyles: Record<string, MixedStyleDeclaration>;
  systemFonts: string[];
  renderersProps: Record<string, unknown>;
  renderers: Record<string, (props: any) => React.ReactNode>;
}

const ArticleChunk = memo(function ArticleChunk(props: ChunkRendererProps) {
  const isDark = useThemeStore((s) => s.themeMode === 'dark');
  const [inactiveBuilt, setInactiveBuilt] = useState(false);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setInactiveBuilt(true);
    });
    return () => handle.cancel();
  }, []);

  const {
    html, contentWidth, lightBaseStyle, darkBaseStyle,
    lightTagsStyles, darkTagsStyles, systemFonts, renderersProps, renderers,
  } = props;

  const common = { contentWidth, systemFonts, renderersProps, renderers };

  return (
    <View>
      <View style={isDark ? chunkStyles.hidden : chunkStyles.visible}>
        <RenderHtml
          {...common}
          source={{ html }}
          baseStyle={lightBaseStyle}
          tagsStyles={lightTagsStyles}
        />
      </View>
      {inactiveBuilt && (
        <View
          style={[StyleSheet.absoluteFill, isDark ? chunkStyles.visible : chunkStyles.hidden]}
          pointerEvents={isDark ? 'auto' : 'none'}>
          <RenderHtml
            {...common}
            source={{ html }}
            baseStyle={darkBaseStyle}
            tagsStyles={darkTagsStyles}
          />
        </View>
      )}
    </View>
  );
});

const chunkStyles = StyleSheet.create({
  visible: { opacity: 1 },
  hidden: { opacity: 0 },
});

export default function ArticleScreen() {
  const { url: encodedUrl, feedUrl: encodedFeedUrl } =
    useLocalSearchParams<{ url: string; feedUrl: string }>();
  const articleUrl = decodeURIComponent(encodedUrl);
  const feedUrl = decodeURIComponent(encodedFeedUrl);
  const { width } = useWindowDimensions();
  const colors = useFluxColors();
  const markTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const article = useArticleStore((s) => s.articles[articleUrl]);
  const toggleRead = useArticleStore((s) => s.toggleRead);
  const ensureBody = useArticleStore((s) => s.ensureBody);

  const [body, setBody] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const contentWidth = width - Spacing.h * 2;

  const lightBaseStyle = useMemo(() => makeBaseStyle(FluxColors.light), []);
  const darkBaseStyle = useMemo(() => makeBaseStyle(FluxColors.dark), []);

  const lightTagsStyles = useMemo(() => makeTagsStyles(FluxColors.light, contentWidth), [contentWidth]);
  const darkTagsStyles = useMemo(() => makeTagsStyles(FluxColors.dark, contentWidth), [contentWidth]);

  const systemFonts = useMemo(
    () => [
      ...(Fonts?.mono ? [Fonts.mono] : []),
      ...(Fonts?.serif ? [Fonts.serif] : []),
    ],
    [],
  );

  const renderers = useMemo(
    () => ({
      pre: ({ TDefaultRenderer, ...props }: any) => (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={chunkRenderers.scroll}>
          <TDefaultRenderer {...props} />
        </ScrollView>
      ),
    }),
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
        lightBaseStyle={lightBaseStyle}
        darkBaseStyle={darkBaseStyle}
        lightTagsStyles={lightTagsStyles}
        darkTagsStyles={darkTagsStyles}
        systemFonts={systemFonts}
        renderersProps={renderersProps}
        renderers={renderers}
      />
    ),
    [contentWidth, lightBaseStyle, darkBaseStyle, lightTagsStyles, darkTagsStyles, systemFonts, renderersProps, renderers],
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
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

const chunkRenderers = StyleSheet.create({
  scroll: {
    backgroundColor: 'transparent',
  },
});

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
