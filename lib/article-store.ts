import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import { create } from 'zustand';

import { cacheBodiesForArticles, getCachedBody } from './cache';
import { parseFeed } from './parser';
import type { Article } from './types';

interface ArticleState {
  // URL -> Article. Record (not array) so single-article subscribers don't
  // re-render when an unrelated article toggles, and so toggleRead can
  // produce a structural diff that's mostly shared with the previous state.
  articles: Record<string, Article>;
  // Per-feed URL list, newest first. Source of truth for ordering.
  feedToUrls: Record<string, string[]>;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  addArticles: (feedUrl: string, articles: Article[]) => void;
  removeArticlesByFeed: (feedUrl: string) => string[];
  toggleRead: (articleUrl: string) => void;
  ensureBody: (articleUrl: string, feedUrl: string) => Promise<string>;
}

const STORAGE_KEY = 'flux-articles';
const LEGACY_STORE_KEY = 'flux-store';
const SAVE_DEBOUNCE_MS = 500;

export const useArticleStore = create<ArticleState>((set, get) => ({
  articles: {},
  feedToUrls: {},
  isHydrated: false,

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as {
          articles?: Record<string, Article>;
          feedToUrls?: Record<string, string[]>;
        };
        set({
          articles: data.articles ?? {},
          feedToUrls: data.feedToUrls ?? {},
          isHydrated: true,
        });
        return;
      }

      // First launch after the split — migrate from the legacy combined
      // store so users don't lose their article history / read state.
      const legacy = await AsyncStorage.getItem(LEGACY_STORE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as {
          state?: { articles?: Article[] };
        };
        const oldArticles = parsed.state?.articles;
        if (Array.isArray(oldArticles) && oldArticles.length > 0) {
          const articles: Record<string, Article> = {};
          const feedToUrls: Record<string, string[]> = {};
          for (const a of oldArticles) {
            articles[a.url] = a;
            (feedToUrls[a.feedUrl] ??= []).push(a.url);
          }
          set({ articles, feedToUrls, isHydrated: true });
          return;
        }
      }

      set({ isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  addArticles: (feedUrl, incoming) => {
    if (incoming.length === 0) return;
    set((s) => {
      const articles = { ...s.articles };
      const fresh: string[] = [];
      for (const a of incoming) {
        if (articles[a.url]) continue;
        articles[a.url] = a;
        fresh.push(a.url);
      }
      if (fresh.length === 0) return s;
      const existing = s.feedToUrls[feedUrl] ?? [];
      return {
        articles,
        feedToUrls: {
          ...s.feedToUrls,
          [feedUrl]: [...fresh, ...existing],
        },
      };
    });
  },

  removeArticlesByFeed: (feedUrl) => {
    const { articles, feedToUrls } = get();
    const urls = feedToUrls[feedUrl] ?? [];
    if (urls.length === 0) return [];
    const nextArticles = { ...articles };
    for (const u of urls) delete nextArticles[u];
    const nextFeedToUrls = { ...feedToUrls };
    delete nextFeedToUrls[feedUrl];
    set({ articles: nextArticles, feedToUrls: nextFeedToUrls });
    return urls;
  },

  toggleRead: (articleUrl) => {
    set((s) => {
      const a = s.articles[articleUrl];
      if (!a) return s;
      return {
        articles: {
          ...s.articles,
          [articleUrl]: { ...a, isRead: !a.isRead },
        },
      };
    });
  },

  ensureBody: async (articleUrl, feedUrl) => {
    const cached = await getCachedBody(articleUrl);
    if (cached) return cached;
    try {
      const parsed = await parseFeed(feedUrl);
      const item = parsed.items.find((i) => i.link === articleUrl);
      const content = item?.content || item?.contentSnippet || '';
      if (content) {
        cacheBodiesForArticles([{ url: articleUrl, content }]).catch(() => {});
      }
      return content;
    } catch {
      return '';
    }
  },
}));

// Manual persistence: debounce writes and run the JSON.stringify off the
// main interaction queue. This is the whole point of the split — toggling
// read on a single article must NOT block taps/animations on a synchronous
// stringify of the entire articles map.
let saveTimer: ReturnType<typeof setTimeout> | null = null;

useArticleStore.subscribe((state, prevState) => {
  if (!state.isHydrated) return;
  if (
    state.articles === prevState.articles &&
    state.feedToUrls === prevState.feedToUrls
  ) {
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    InteractionManager.runAfterInteractions(() => {
      const s = useArticleStore.getState();
      try {
        const json = JSON.stringify({
          articles: s.articles,
          feedToUrls: s.feedToUrls,
        });
        AsyncStorage.setItem(STORAGE_KEY, json).catch(() => {});
      } catch {
        // serialization failures are non-fatal; we'll try again on the next change
      }
    });
  }, SAVE_DEBOUNCE_MS);
});
