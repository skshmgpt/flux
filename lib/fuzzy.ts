export interface FuzzyResult {
  url: string;
  score: number;
}

interface FuzzyMatch {
  start: number;
  end: number;
}

function fuzzyMatch(query: string, text: string): FuzzyMatch[] | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const matches: FuzzyMatch[] = [];
  let qi = 0;
  let lastMatch = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (lastMatch !== -1 && ti === lastMatch + 1 && matches.length > 0) {
        matches[matches.length - 1].end = ti;
      } else {
        matches.push({ start: ti, end: ti });
      }
      lastMatch = ti;
      qi++;
    }
  }

  if (qi < q.length) return null;
  return matches;
}

function fuzzyScore(query: string, text: string): number {
  const matches = fuzzyMatch(query, text);
  if (!matches) return 0;

  let score = 0;

  for (const m of matches) {
    score += 10 + (m.end - m.start) * 5;
  }

  const consecutiveBonus = Math.pow(matches.length, 2);
  score += consecutiveBonus * 3;

  for (const m of matches) {
    const char = text[m.start];
    if (char === char.toUpperCase() && char !== char.toLowerCase()) {
      score += 5;
    }
    if (m.start === 0 || text[m.start - 1] === ' ' || text[m.start - 1] === '-' || text[m.start - 1] === '_') {
      score += 3;
    }
  }

  const gapPenalty = matches.length > 1
    ? (matches[matches.length - 1].start - matches[0].end) * 0.15
    : 0;
  score -= gapPenalty;

  if (matches[0].start === 0) score += 4;

  score -= text.length * 0.02;

  return score;
}

export function search<T>(
  query: string,
  items: T[],
  getText: (item: T) => string,
  topN = 50,
): T[] {
  const q = query.trim();
  if (!q) return [];

  const scored: { item: T; score: number }[] = [];

  for (const item of items) {
    const text = getText(item);
    if (!text) continue;
    const score = fuzzyScore(q, text);
    if (score > 1) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map((s) => s.item);
}
