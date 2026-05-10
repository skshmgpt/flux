import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { cacheBodiesForArticles, getCachedBody, removeBodies } from './cache';
import { parseFeed } from './parser';
import type { Article, Feed, RawArticle } from './types';

type ThemeMode = 'light' | 'dark';

interface FluxState {
  feeds: Feed[];
  articles: Article[];
  isHydrated: boolean;
  themeMode: ThemeMode;

  setHydrated: () => void;
  toggleTheme: () => void;
  addFeed: (url: string) => Promise<void>;
  removeFeed: (url: string) => Promise<void>;
  refreshFeed: (url: string) => Promise<void>;
  refreshAllFeeds: () => Promise<void>;
  toggleRead: (articleUrl: string) => void;
  ensureBody: (articleUrl: string, feedUrl: string) => Promise<string>;
}

export const useStore = create<FluxState>()(
  persist(
    (set, get) => ({
      feeds: [],
      articles: [],
      isHydrated: false,
      themeMode: 'light',

      setHydrated: () => set({ isHydrated: true }),

      toggleTheme: () =>
        set((s) => ({
          themeMode: s.themeMode === 'dark' ? 'light' : 'dark',
        })),

      addFeed: async (url: string) => {
        const parsed = await parseFeed(url);
        const feed: Feed = {
          url,
          title: parsed.title || url,
          description: parsed.description,
          lastFetchedAt: Date.now(),
        };

        const rawArticles: RawArticle[] = parsed.items
          .filter((item) => item.link)
          .map((item) => ({
            url: item.link,
            feedUrl: url,
            title: item.title || 'Untitled',
            author: item.creator || undefined,
            publishedAt: item.pubDate || '',
            content: item.content || item.contentSnippet || '',
            isRead: false,
          }));

        const articles: Article[] = rawArticles.map(
          ({ content: _c, ...rest }) => rest,
        );

        await cacheBodiesForArticles(rawArticles, 10);

        set((state) => ({
          feeds: [feed, ...state.feeds],
          articles: [...articles, ...state.articles],
        }));
      },

      removeFeed: async (url: string) => {
        const { articles } = get();
        const removed = articles.filter((a) => a.feedUrl === url);
        await removeBodies(removed.map((a) => a.url));

        set((state) => ({
          feeds: state.feeds.filter((f) => f.url !== url),
          articles: state.articles.filter((a) => a.feedUrl !== url),
        }));
      },

      refreshFeed: async (url: string) => {
        const parsed = await parseFeed(url);
        const { articles: existingArticles } = get();

        const existingUrls = new Set(
          existingArticles.filter((a) => a.feedUrl === url).map((a) => a.url),
        );

        const rawArticles: RawArticle[] = parsed.items
          .filter((item) => item.link && !existingUrls.has(item.link))
          .map((item) => ({
            url: item.link,
            feedUrl: url,
            title: item.title || 'Untitled',
            author: item.creator || undefined,
            publishedAt: item.pubDate || '',
            content: item.content || item.contentSnippet || '',
            isRead: false,
          }));

        if (rawArticles.length > 0) {
          const newArticles: Article[] = rawArticles.map(
            ({ content: _c, ...rest }) => rest,
          );
          await cacheBodiesForArticles(rawArticles, 10);

          set((state) => ({
            articles: [...newArticles, ...state.articles],
            feeds: state.feeds.map((f) =>
              f.url === url ? { ...f, lastFetchedAt: Date.now() } : f,
            ),
          }));
        } else {
          set((state) => ({
            feeds: state.feeds.map((f) =>
              f.url === url ? { ...f, lastFetchedAt: Date.now() } : f,
            ),
          }));
        }
      },

      refreshAllFeeds: async () => {
        const { feeds } = get();
        for (const feed of feeds) {
          try {
            await get().refreshFeed(feed.url);
          } catch {
            // Silently skip failed feeds; stale data is better than a crash
          }
        }
      },

      toggleRead: (articleUrl: string) => {
        set((state) => ({
          articles: state.articles.map((a) =>
            a.url === articleUrl ? { ...a, isRead: !a.isRead } : a,
          ),
        }));
      },

      ensureBody: async (articleUrl: string, feedUrl: string) => {
        const cached = await getCachedBody(articleUrl);
        if (cached) return cached;

        // Re-fetch the feed to get this article's content
        const parsed = await parseFeed(feedUrl);
        const item = parsed.items.find((i) => i.link === articleUrl);
        const content = item?.content || item?.contentSnippet || '';
        if (content) {
          await cacheBodiesForArticles(
            [{ url: articleUrl, content }],
            1,
          );
        }
        return content;
      },
    }),
    {
      name: 'flux-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        feeds: state.feeds,
        articles: state.articles,
        themeMode: state.themeMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated();
          state.refreshAllFeeds();
        }
      },
    },
  ),
);
