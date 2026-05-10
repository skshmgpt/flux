# Flux RSS Reader — v0.1 Design Spec

## Overview

A minimal RSS reader for iOS and Android (Expo SDK 54). Feed-first organization, native HTML rendering (no WebView), local-only storage, single-user. System monospace (SF Mono / JetBrains Mono) for UI chrome, serif for body text. The app is named **Flux**.

**Core principle:** No loaders. All loading pushed to background. The user always sees something meaningful — stale data > blank screen.

---

## Architecture

### Tech Stack

| Concern | Library | Notes |
|---|---|---|
| Framework | Expo SDK 54 + expo-router | Already installed |
| Navigation | expo-router (native stack + tabs) | Already installed |
| State | Zustand with AsyncStorage persist | Add `zustand` |
| HTML render | `react-native-render-html` | Native Text/View, no WebView |
| RSS parse | `rss-parser` | Pure JS, works in RN |
| Fonts | SF Mono, JetBrains Mono, New York, Noto Serif | System fonts + expo-font bundle |
| Animations | react-native-reanimated | Already installed |

### Data Model

```
Feed {
  url: string         // unique key (the RSS URL)
  title: string
  description?: string
  lastFetchedAt: number
}

// Stored in Zustand persist (metadata only — no HTML):
Article {
  url: string         // unique key (the article link)
  feedUrl: string     // parent feed
  title: string
  author?: string
  publishedAt: string
  isRead: boolean
}

// HTML content lives ONLY in AsyncStorage body cache:
// key: "body-cache:${articleUrl}" → raw HTML string
// This avoids storing large HTML blobs in Zustand's JSON serialization.
```

### State Store

Single Zustand store (`useStore`), persisted to AsyncStorage:

- `feeds: Feed[]`
- `articles: Article[]` (metadata only, no HTML content)
- `addFeed(url)` — fetch RSS, parse, store feed + articles, cache bodies for the 10 most recent
- `removeFeed(url)` — delete feed, its articles, and all body cache keys for that feed
- `refreshFeed(url)` — refetch, merge new articles (preserve read status), cache bodies for new articles found
- `refreshAllFeeds()` — call refreshFeed for each subscribed feed sequentially
- `toggleRead(articleUrl)` — flip isRead boolean

Refresh happens in two places ONLY: on app open (useEffect in root layout) and on pull-to-refresh per feed/all feeds. No background polling timer.

### Article Body Cache

Separate AsyncStorage keys: `body-cache:${articleUrl}` → raw HTML string.

- At feed-add time: cache bodies for the 10 most recent articles. Small feeds (< 10 articles) get fully cached with no extra cost.
- On article open: if body is cached → render instantly. If not cached → render article header instantly from store metadata, fetch body in background, populate body area when ready. The header (title, author, date) is visible immediately — this is progressive rendering, not a loader.
- On feed refresh: cache bodies for new articles found in the refresh.
- On feed removal: clear all `body-cache:${url}` keys for articles belonging to that feed.

---

## Screens & Navigation

```
Root Stack
  └── Tabs
        ├── Feeds tab (feed list)
        │     └── Feed articles (stack push)
        │           └── Article reading (stack push)
        └── Add Feed tab (URL input)
```

### 1. Feeds Screen (Tab 1)

- Scrollable list of subscribed feeds
- Each row: feed title + unread count + relative timestamp ("2h ago")
- Hairline separator between rows, generous vertical padding
- Pull-to-refresh: refreshes all feeds, swaps data in when ready, old data stays visible
- Tap → push to feed article list
- Long-press → context menu with "Remove feed" (with confirmation)
- Empty state: "No feeds yet" with a subtle prompt and tab hint
- Stale indicator: if `lastFetchedAt` is > 1 hour, show a subtle muted dot next to timestamp

### 2. Feed Article List (Stack push)

- Reverse-chronological article list for a single feed
- Each row: title, date, subtle unread dot (left of title, `#3553FF`)
- Hairline separators
- Tap → push to reading screen
- Pull-to-refresh: refresh just this feed

### 3. Reading Screen (Stack push)

- Top bar: back arrow + toggle-unread (ghost button, no background)
- Article header: title (mono, 20px, weight 600) + author · date (mono, 13px, muted)
- Hairline rule below header
- Article body: `react-native-render-html` rendering, serif 17px, 1.6 line-height, generous horizontal padding (24px)
- No card container — content flows edge to edge
- Links open in system browser via `expo-web-browser`
- Mark read on enter (300ms debounce to avoid marking on quick navigation)

### 4. Add Feed Screen (Tab 2)

- Single text input for RSS URL
- Ghost submit button or return-key submit
- On submit: dismiss keyboard, show brief inline status
- On success: feed title + article count preview, "Subscribe" button
- On subscribe: add to store, navigate to Feeds tab
- Error: inline error text below input (invalid URL, not RSS)
- After subscribing, input clears for next add

---

## Visual System

### Colors

```
Primary:    #3553FF (single accent)

Light mode:
  bg:       #FFFFFF
  text:     #0A0A0A
  surface:  #F5F7FF (barely-tinted white)
  muted:    #9CA3AF
  border:   #E5E7EB (0.5px hairlines)
  gradient: #3553FF → #6679FF → #B3BDFF → #E8EBFF → #FFFFFF

Dark mode:
  bg:       #0A0A0A
  text:     #FFFFFF
  surface:  #11132B (deep navy tint)
  muted:    #6B7280
  border:   #1F2937
  gradient: #3553FF → #1A2A8A → #0F1554 → #0A0E2A → #0A0A0A
```

### Typography

```
UI chrome (monospace):
  Title:  20px, weight 600
  Label:  15px, weight 400
  Meta:   12px, weight 400, muted

Article body (serif):
  Body:   17px, weight 400, 1.6 line-height
  Fallback: system serif → New York (iOS) / Noto Serif (Android)
  When article specifies font-family: cascade, serif as final fallback
```

### Layout Principles

- Generous whitespace: 24px horizontal padding, 16-20px vertical item gaps
- Hairline 0.5px separators between list items
- No card backgrounds on lists — rows on the bg
- Reading screen: content edge-to-edge, no containing card
- Ghost buttons for secondary actions (text only, no background)
- Primary button: `#3553FF` fill, white text, 12px radius

### Animations (Reanimated, withTiming)

- Feed tiles: 15px slide-up + fade, staggered 50ms on first appear
- Article open: subtle scale 0.97→1 + fade, 150ms
- Pull-to-refresh: content shifts down, snaps back
- No spring physics, all withTiming at 150-200ms
- No loader spinners anywhere in the UI

---

## No-Loaders UX

| Scenario | Strategy |
|---|---|
| App cold open | Render persisted store instantly. Background refresh when network available. |
| Pull-to-refresh | Old data stays visible. Swap in new data when parsed. |
| Open article | Header renders instantly from metadata. Cached body available for recent articles; uncached bodies fetch in background and populate progressively. |
| Add feed | Submit → input clears → feed tile appears optimistically. Errors surface inline. |

---

## What's Out of Scope (v0.1)

- Highlighting and notes
- OPML import/export
- Offline-first (full offline reading without prior cache)
- Cloud sync / accounts
- Search
- Categories / folders
- Any settings screen
- Full-text article search

---

## Dependencies to Add

```
zustand          — state management with persist
react-native-render-html — HTML → native components
rss-parser       — RSS/Atom feed parsing
```
