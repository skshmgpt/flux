// Minimal RSS/Atom parser — no external XML deps.
// Handles RSS 2.0, Atom, and RDF 1.0 using regex extraction.
// Sufficient for v0.1; upgrade to a full parser if edge cases surface.

export interface ParsedFeed {
  title: string;
  description?: string;
  items: ParsedItem[];
}

export interface ParsedItem {
  title: string;
  link: string;
  content: string;
  contentSnippet: string;
  pubDate: string;
  creator?: string;
}

function tag(name: string, xml: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = xml.match(re);
  return (m ? m[1].trim() : '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
}

// Heuristic: if content has escaped tag delimiters but no real tags,
// the publisher escaped the HTML with entities instead of wrapping it
// in CDATA — decode so the renderer sees actual markup.
function maybeDecodeEscapedHtml(s: string): string {
  if (!s) return s;
  const hasEscapedTag = /&lt;\s*\/?\s*[a-zA-Z]/.test(s);
  const hasRealTag = /<\s*\/?\s*[a-zA-Z]/.test(s);
  return hasEscapedTag && !hasRealTag ? decodeEntities(s) : s;
}

function tags(name: string, xml: string): string[] {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
  }
  return results;
}

function attr(name: string, attrName: string, xml: string): string {
  const re = new RegExp(`<${name}[^>]*${attrName}\\s*=\\s*["']([^"']*)["'][^>]*>`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function parseItem(xml: string): ParsedItem {
  const title = tag('title', xml);
  let link = tag('link', xml);

  // Atom link with href attribute
  if (!link) {
    link = attr('link', 'href', xml);
  }

  const content = maybeDecodeEscapedHtml(
    tag('content:encoded', xml) ||
      tag('content', xml) ||
      tag('summary', xml) ||
      tag('description', xml),
  );

  const contentSnippet =
    maybeDecodeEscapedHtml(tag('summary', xml) || tag('description', xml)) ||
    content.replace(/<[^>]*>/g, '').slice(0, 200);

  const pubDate =
    tag('pubDate', xml) ||
    tag('published', xml) ||
    tag('updated', xml) ||
    tag('dc:date', xml);

  const creator =
    tag('dc:creator', xml) ||
    tag('creator', xml) ||
    tag('author', xml);

  return {
    title: title || 'Untitled',
    link: link || '',
    content,
    contentSnippet: contentSnippet || '',
    pubDate: pubDate || '',
    creator: creator || undefined,
  };
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status}`);
  }
  const xml = await response.text();

  // RSS 2.0
  const rssChannel = xml.match(/<rss[\s\S]*?<channel>([\s\S]*?)<\/channel>/i);
  if (rssChannel) {
    const channel = rssChannel[1];
    const itemBlocks = tags('item', channel);
    return {
      title: tag('title', channel) || url,
      description: tag('description', channel) || undefined,
      items: itemBlocks.map(parseItem),
    };
  }

  // Atom
  const atomFeed = xml.match(/<feed[\s\S]*?<\/feed>/i);
  if (atomFeed) {
    const feedXml = atomFeed[0];
    const entryBlocks = tags('entry', feedXml);
    return {
      title: tag('title', feedXml) || url,
      description: tag('subtitle', feedXml) || undefined,
      items: entryBlocks.map(parseItem),
    };
  }

  // RDF (RSS 1.0)
  const rdf = xml.match(/<rdf:RDF[\s\S]*?<\/rdf:RDF>/i);
  if (rdf) {
    const rdfXml = rdf[0];
    const channelXml = rdfXml.match(/<channel[\s\S]*?<\/channel>/i)?.[0] ?? '';
    const itemBlocks = tags('item', rdfXml);
    return {
      title: tag('title', channelXml) || url,
      description: tag('description', channelXml) || undefined,
      items: itemBlocks.map(parseItem),
    };
  }

  throw new Error('Unrecognized feed format. Expected RSS or Atom.');
}
