import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useArticleStore } from './article-store';
import { cacheBodiesForArticles, removeBodies } from './cache';
import { parseFeed } from './parser';
import type { Article, Feed, RawArticle } from './types';

interface FluxState {
  feeds: Feed[];
  isHydrated: boolean;

  setHydrated: () => void;
  addFeed: (url: string) => Promise<void>;
  removeFeed: (url: string) => Promise<void>;
  refreshFeed: (url: string) => Promise<void>;
  refreshAllFeeds: () => Promise<void>;
}

export const useStore = create<FluxState>()(
  persist(
    (set, get) => ({
      feeds: [],
      isHydrated: false,

      setHydrated: () => set({ isHydrated: true }),

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

        useArticleStore.getState().addArticles(url, articles);

        set((state) => ({ feeds: [feed, ...state.feeds] }));

        const toCache = rawArticles.filter((a) => a.content && a.content.length > 0);
        if (toCache.length > 0) {
          cacheBodiesForArticles(toCache).catch(() => {});
        }
      },

      removeFeed: async (url: string) => {
        const removedUrls = useArticleStore
          .getState()
          .removeArticlesByFeed(url);
        await removeBodies(removedUrls);
        set((state) => ({ feeds: state.feeds.filter((f) => f.url !== url) }));
      },

      refreshFeed: async (url: string) => {
        const parsed = await parseFeed(url);
        const articleStore = useArticleStore.getState();
        const existing = new Set(articleStore.feedToUrls[url] ?? []);

        const rawArticles: RawArticle[] = parsed.items
          .filter((item) => item.link && !existing.has(item.link))
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
          articleStore.addArticles(url, newArticles);

          const toCache = rawArticles.filter(
            (a) => a.content && a.content.length > 0,
          );
          if (toCache.length > 0) {
            cacheBodiesForArticles(toCache).catch(() => {});
          }
        }

        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.url === url ? { ...f, lastFetchedAt: Date.now() } : f,
          ),
        }));
      },

      refreshAllFeeds: async () => {
        const { feeds } = get();
        // Skip feeds fetched in the last 10 minutes — most launches are no-ops.
        const STALE_MS = 10 * 60 * 1000;
        const now = Date.now();
        const stale = feeds.filter((f) => now - f.lastFetchedAt > STALE_MS);
        await Promise.all(
          stale.map((f) => get().refreshFeed(f.url).catch(() => {})),
        );
      },
    }),
    {
      name: 'flux-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        feeds: state.feeds,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHydrated();
      },
    },
  ),
);
