import type { FeedItem } from './types'

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”'
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? whole
  })
}

/**
 * Element text as a plain string: CDATA unwrapped, entities decoded, and
 * any markup stripped (some feeds put `<b>` etc. in titles, escaped or
 * not). Decoding happens before tag-stripping so entity-escaped HTML
 * (`&lt;b&gt;`) is stripped too.
 */
function textContent(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  const decoded = decodeEntities(unwrapped.replace(/<[^>]*>/g, ''))
  return decoded
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tagPattern(tag: string): RegExp {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
}

function firstTag(xml: string, tags: string[]): string | null {
  for (const tag of tags) {
    const match = xml.match(tagPattern(tag))
    if (match) return match[1]
  }
  return null
}

function blocks(xml: string, tag: string): string[] {
  return xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, 'gi')) ?? []
}

/** Atom puts the link in an attribute; prefer rel="alternate" (or no rel) over rel="self"/"edit"/etc. */
function atomLink(entry: string): string | null {
  const links = entry.match(/<link\b[^>]*>/gi) ?? []
  let fallback: string | null = null
  for (const link of links) {
    const href = link.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!href) continue
    const rel = link.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!rel || rel === 'alternate') return decodeEntities(href)
    fallback ??= decodeEntities(href)
  }
  return fallback
}

function parseDate(raw: string | null): number | null {
  if (!raw) return null
  const ms = Date.parse(textContent(raw))
  return Number.isNaN(ms) ? null : ms
}

/**
 * Parses an RSS 2.0, RSS 1.0 (RDF) or Atom feed into its title and items.
 * Deliberately a small tolerant scanner rather than a full XML parser —
 * the zone only needs title/link/date per item, and real-world feeds are
 * often not well-formed enough for a strict parser anyway. Throws if the
 * document doesn't look like a feed at all.
 */
export function parseFeed(xml: string): { title: string; items: FeedItem[] } {
  const isAtom = /<feed\b[^>]*>/i.test(xml) && !/<rss\b|<rdf:RDF\b/i.test(xml)
  const rawItems = isAtom ? blocks(xml, 'entry') : blocks(xml, 'item')

  if (!isAtom && rawItems.length === 0 && !/<rss\b|<rdf:RDF\b|<channel\b/i.test(xml)) {
    throw new Error("That URL didn't return an RSS or Atom feed")
  }

  // Feed title: the first <title> outside any item/entry.
  const head = xml.replace(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi, '')
  const title = textContent(firstTag(head, ['title']) ?? '')

  const items: FeedItem[] = rawItems.map((item, index) => {
    const itemTitle = textContent(firstTag(item, ['title']) ?? '') || 'Untitled'
    const link = isAtom
      ? atomLink(item)
      : textContent(firstTag(item, ['link']) ?? '') ||
        item.match(/<guid\b[^>]*isPermaLink\s*=\s*["']true["'][^>]*>([\s\S]*?)<\/guid>/i)?.[1] ||
        null
    const published = parseDate(
      firstTag(item, isAtom ? ['published', 'updated'] : ['pubDate', 'dc:date', 'updated'])
    )
    const id = textContent(firstTag(item, ['guid', 'id']) ?? '') || link || `${index}-${itemTitle}`
    return { id, title: itemTitle, link: link ? link.trim() : null, published }
  })

  return { title, items }
}
