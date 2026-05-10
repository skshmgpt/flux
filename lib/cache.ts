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

export async function cacheBodiesForArticles(
  articles: Array<{ url: string; content: string }>,
  maxRecent = 10,
): Promise<void> {
  const toCache = articles.slice(0, maxRecent);
  await Promise.all(
    toCache.map((a) => AsyncStorage.setItem(PREFIX + a.url, a.content)),
  );
}
