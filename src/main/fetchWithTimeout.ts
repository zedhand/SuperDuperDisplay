/** `fetch` that aborts after `ms`, with a readable error instead of a bare AbortError. */
export async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SuperDuperDisplay' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Timed out fetching ${new URL(url).host}`)
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
