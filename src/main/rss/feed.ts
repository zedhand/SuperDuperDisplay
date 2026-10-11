import type { FeedItem } from '@shared/types'
import { parseFeed } from '@shared/feed'
import { fetchWithTimeout } from '../fetchWithTimeout'

const CACHE_TTL_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 10_000
const MAX_ITEMS = 50

const cache = new Map<string, { fetchedAt: number; title: string; items: FeedItem[] }>()

/**
 * Fetches and parses an RSS/Atom feed URL for the RSS zone. Main-process
 * side so the renderer isn't subject to CORS (almost no feed sends CORS
 * headers). Cached per URL, with the same stale-on-error fallback as the
 * calendar agenda and weather.
 */
export async function getFeed(
  feedUrl: string
): Promise<{ title: string; items: FeedItem[]; error?: string }> {
  const url = feedUrl.trim()
  if (!/^https?:\/\//i.test(url)) {
    return { title: '', items: [], error: 'Feed URL must start with http:// or https://' }
  }

  const cached = cache.get(url)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { title: cached.title, items: cached.items }
  }

  try {
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
    const { title, items } = parseFeed(await response.text())
    const trimmed = items.slice(0, MAX_ITEMS)
    cache.set(url, { fetchedAt: Date.now(), title, items: trimmed })
    return { title, items: trimmed }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (cached) return { title: cached.title, items: cached.items, error: message }
    return { title: '', items: [], error: message }
  }
}
