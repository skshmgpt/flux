import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'body-cache:';

export async function cacheBody(articleUrl: string, html: string): Promise<void> {
  await AsyncStorage.setItem(PREFIX + articleUrl, html);
}

export async function getCachedBody(articleUrl: string): Promise<string | null> {
  return AsyncStorage.getItem(PREFIX + articleUrl);
}

export async function removeBodies(articleUrls: string[]): Promise<void> {
  if (articleUrls.length === 0) return;
  await Promise.all(
    articleUrls.map((url) => AsyncStorage.removeItem(PREFIX + url)),
  );
}

const CACHE_BATCH = 20;

export async function cacheBodiesForArticles(
  articles: Array<{ url: string; content: string }>,
): Promise<void> {
  for (let i = 0; i < articles.length; i += CACHE_BATCH) {
    const batch = articles.slice(i, i + CACHE_BATCH);
    await Promise.all(
      batch.map((a) => AsyncStorage.setItem(PREFIX + a.url, a.content)),
    );
    // Yield to the JS thread so taps/animations don't stall during a big cache.
    if (i + CACHE_BATCH < articles.length) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
}
