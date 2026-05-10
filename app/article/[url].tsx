import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import RenderHtml from 'react-native-render-html';

import { FluxHeader } from '@/components/flux-header';
import { FluxColorSet, FluxColors, Fonts, Spacing, Typography } from '@/constants/theme';
import { useFluxColors } from '@/hooks/use-flux-colors';
import { getCachedBody } from '@/lib/cache';
import { useStore } from '@/lib/store';

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

export default function ArticleScreen() {
  const { url: encodedUrl, feedUrl: encodedFeedUrl } =
    useLocalSearchParams<{ url: string; feedUrl: string }>();
  const articleUrl = decodeURIComponent(encodedUrl);
  const feedUrl = decodeURIComponent(encodedFeedUrl);
  const { width } = useWindowDimensions();
  const colors = useFluxColors();
  const markTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const article = useStore((s) => s.articles.find((a) => a.url === articleUrl));
  const toggleRead = useStore((s) => s.toggleRead);
  const ensureBody = useStore((s) => s.ensureBody);

  const [body, setBody] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const htmlTagsStyles = useMemo(
    () => ({
      a: { color: FluxColors.primary, textDecorationLine: 'underline' as const },
      img: { maxWidth: width - Spacing.h * 2 },
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
        backgroundColor: colors.surface,
        paddingHorizontal: 4,
        borderRadius: 3,
      },
      pre: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 13,
        lineHeight: 20,
        backgroundColor: colors.surface,
        padding: Spacing.md,
        borderRadius: 8,
        marginBottom: Spacing.md,
        overflow: 'hidden' as const,
      },
      'pre code': {
        backgroundColor: 'transparent',
        paddingHorizontal: 0,
      },
      h1: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 22,
        fontWeight: '700' as const,
        color: colors.text,
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
        lineHeight: 30,
      },
      h2: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 19,
        fontWeight: '600' as const,
        color: colors.text,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
        lineHeight: 26,
      },
      h3: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 17,
        fontWeight: '600' as const,
        color: colors.text,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
        lineHeight: 24,
      },
      h4: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 15,
        fontWeight: '600' as const,
        color: colors.text,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
        lineHeight: 22,
      },
      h5: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 14,
        fontWeight: '600' as const,
        color: colors.muted,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xs,
        lineHeight: 20,
      },
      h6: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 13,
        fontWeight: '600' as const,
        color: colors.muted,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xs,
        lineHeight: 18,
      },
      p: {
        marginBottom: Spacing.md,
        lineHeight: Typography.body.lineHeight,
      },
      ul: {
        marginBottom: Spacing.md,
        paddingLeft: Spacing.md,
      },
      ol: {
        marginBottom: Spacing.md,
        paddingLeft: Spacing.md,
      },
      li: {
        marginBottom: 4,
        lineHeight: Typography.body.lineHeight,
      },
      hr: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginVertical: Spacing.md,
        borderWidth: 0,
      },
      figure: {
        marginBottom: Spacing.md,
        marginLeft: 0,
        marginRight: 0,
      },
      figcaption: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 12,
        color: colors.muted,
        marginTop: 4,
        textAlign: 'center' as const,
      },
      table: {
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 4,
      },
      th: {
        fontFamily: Fonts?.mono ?? 'monospace',
        fontSize: 13,
        fontWeight: '600' as const,
        color: colors.text,
        backgroundColor: colors.surface,
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      td: {
        padding: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        lineHeight: Typography.body.lineHeight,
      },
      strong: { fontWeight: '700' as const },
      em: { fontStyle: 'italic' as const },
    }),
    [colors, width],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await getCachedBody(articleUrl);
      if (!cancelled) setBody(cached);

      if (!cached) {
        try {
          const html = await ensureBody(articleUrl, feedUrl);
          if (!cancelled && html) setBody(html);
        } catch {
          // Header still visible even if body fetch fails
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [articleUrl, feedUrl]);

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
  }, [articleUrl]);

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
      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{article.title}</Text>
      <View style={styles.metaRow}>
        {article.author && <Text style={styles.meta}>{article.author}</Text>}
        {article.author && <Text style={styles.meta}> · </Text>}
        <Text style={styles.meta}>{formatDate(article.publishedAt)}</Text>
      </View>
      <View style={styles.rule} />

      <Pressable style={styles.toggleRead} onPress={() => toggleRead(articleUrl)}>
        <Text style={styles.toggleReadText}>
          {article.isRead ? 'Mark unread' : 'Mark read'}
        </Text>
      </Pressable>

      {body ? (
        <RenderHtml
          contentWidth={width - Spacing.h * 2}
          source={{ html: body }}
          baseStyle={styles.bodyText}
          systemFonts={[
            ...(Fonts?.mono ? [Fonts.mono] : []),
            ...(Fonts?.serif ? [Fonts.serif] : []),
          ]}
          tagsStyles={htmlTagsStyles}
          renderersProps={{
            a: {
              onPress: (_e, href) => {
                if (href) WebBrowser.openBrowserAsync(href);
              },
            },
          }}
        />
        ) : (
          <View style={styles.bodyPlaceholder} />
        )}
      </ScrollView>
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
    bodyText: {
      fontFamily: Fonts?.serif ?? 'serif',
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
      color: c.text,
    },
    bodyPlaceholder: {
      flex: 1,
      minHeight: 200,
    },
    errorText: {
      fontFamily: Fonts?.mono ?? 'monospace',
      fontSize: Typography.label.fontSize,
      color: c.muted,
      padding: Spacing.h,
    },
  });
