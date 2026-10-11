import { describe, expect, it } from 'vitest'
import { parseFeed } from '../src/shared/feed'

describe('parseFeed', () => {
  it('parses RSS 2.0 items with CDATA and entities', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <title>Example &amp; Co News</title>
        <atom:link href="https://example.com/feed" rel="self" />
        <item>
          <title><![CDATA[First <b>story</b>]]></title>
          <link>https://example.com/1</link>
          <guid>story-1</guid>
          <pubDate>Sat, 10 Oct 2026 12:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Tom &#38; Jerry&#8217;s &quot;day&quot;</title>
          <link>https://example.com/2</link>
        </item>
      </channel></rss>`
    const feed = parseFeed(xml)
    expect(feed.title).toBe('Example & Co News')
    expect(feed.items).toHaveLength(2)
    expect(feed.items[0]).toEqual({
      id: 'story-1',
      title: 'First story',
      link: 'https://example.com/1',
      published: Date.parse('Sat, 10 Oct 2026 12:00:00 GMT')
    })
    expect(feed.items[1].title).toBe('Tom & Jerry’s "day"')
    expect(feed.items[1].id).toBe('https://example.com/2')
    expect(feed.items[1].published).toBeNull()
  })

  it('parses Atom entries, preferring the alternate link', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
      <title type="text">Atom Blog</title>
      <entry>
        <title type="html">Post &lt;em&gt;one&lt;/em&gt;</title>
        <link rel="edit" href="https://example.com/edit/1"/>
        <link rel="alternate" href="https://example.com/posts/1"/>
        <id>urn:post:1</id>
        <updated>2026-10-09T08:00:00Z</updated>
      </entry>
    </feed>`
    const feed = parseFeed(xml)
    expect(feed.title).toBe('Atom Blog')
    expect(feed.items).toEqual([
      {
        id: 'urn:post:1',
        title: 'Post one',
        link: 'https://example.com/posts/1',
        published: Date.parse('2026-10-09T08:00:00Z')
      }
    ])
  })

  it('parses RSS 1.0 (RDF) items', () => {
    const xml = `<rdf:RDF><channel><title>RDF Feed</title></channel>
      <item rdf:about="https://example.com/a"><title>A</title><link>https://example.com/a</link>
      <dc:date>2026-10-01T00:00:00Z</dc:date></item></rdf:RDF>`
    const feed = parseFeed(xml)
    expect(feed.title).toBe('RDF Feed')
    expect(feed.items[0].title).toBe('A')
    expect(feed.items[0].published).toBe(Date.parse('2026-10-01T00:00:00Z'))
  })

  it('rejects a document that is not a feed', () => {
    expect(() => parseFeed('<html><body>Not a feed</body></html>')).toThrow()
  })
})
