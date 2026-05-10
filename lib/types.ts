export interface Feed {
  url: string;
  title: string;
  description?: string;
  lastFetchedAt: number;
}

export interface Article {
  url: string;
  feedUrl: string;
  title: string;
  author?: string;
  publishedAt: string;
  isRead: boolean;
}

/** Raw article as it comes from the RSS parser, before we strip content for store. */
export interface RawArticle extends Article {
  content: string;
}
