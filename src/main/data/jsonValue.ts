import { formatDataValue, getByPath, parseHeaderLines } from '@shared/dataPath'

const TIMEOUT_MS = 10_000
const MAX_BYTES = 1_000_000
const MIN_INTERVAL_MS = 5_000

const cache = new Map<string, { fetchedAt: number; value: string }>()

export interface DataResult {
  value: string | null
  error?: string
}

/**
 * Fetches a JSON URL (optionally with custom headers, e.g. a Home Assistant
 * or Twitch bearer token) and reads one value out of it by path. Runs in the
 * main process so no CORS rules apply and secrets never touch a web page.
 * Results are cached briefly per URL+headers+path so several zones — or a
 * scene switch — can't hammer someone's API. On failure, the last good value
 * is returned alongside the error rather than blanking the zone.
 */
export async function getDataValue(
  url: string,
  headersText: string,
  path: string
): Promise<DataResult> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { value: null, error: 'Enter a valid URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { value: null, error: 'Only http(s) URLs are supported' }
  }

  const key = `${url}\n${headersText}\n${path}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.fetchedAt < MIN_INTERVAL_MS) return { value: hit.value }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SuperDuperDisplay', ...parseHeaderLines(headersText) }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    if (text.length > MAX_BYTES) throw new Error('Response too large')
    const raw = path.trim() ? getByPath(JSON.parse(text), path) : text.trim()
    const value = formatDataValue(raw)
    if (value == null) throw new Error(`Nothing at "${path}" in the response`)
    cache.set(key, { fetchedAt: Date.now(), value })
    return { value }
  } catch (err) {
    const message = controller.signal.aborted
      ? `Timed out fetching ${parsed.host}`
      : (err as Error).message
    return { value: hit?.value ?? null, error: message }
  } finally {
    clearTimeout(timer)
  }
}
