import { describe, expect, it } from 'vitest'
import { buildYoutubeEmbedRelayUrl, extractYoutubeId } from '../src/shared/youtube'

describe('extractYoutubeId', () => {
  it('extracts the id from a standard watch URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts the id from a watch URL with extra query params', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toBe(
      'dQw4w9WgXcQ'
    )
  })

  it('extracts the id from a youtu.be short link', () => {
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts the id from an existing embed URL', () => {
    expect(extractYoutubeId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    )
  })

  it('extracts the id from a shorts URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('accepts a bare video id', () => {
    expect(extractYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for an unrecognized input', () => {
    expect(extractYoutubeId('https://example.com/not-youtube')).toBeNull()
    expect(extractYoutubeId('too-short')).toBeNull()
  })
})

describe('buildYoutubeEmbedRelayUrl', () => {
  it('points at the https relay page with the video id and initial volume', () => {
    const url = new URL(buildYoutubeEmbedRelayUrl('dQw4w9WgXcQ', 40))
    expect(url.origin).toBe('https://zedhand.github.io')
    expect(url.pathname).toBe('/superduperdisplay-yt-embed/')
    expect(url.searchParams.get('v')).toBe('dQw4w9WgXcQ')
    expect(url.searchParams.get('volume')).toBe('40')
  })

  it('url-encodes the video id', () => {
    const url = buildYoutubeEmbedRelayUrl('a&b=c', 0)
    expect(url).toContain('v=a%26b%3Dc')
    expect(new URL(url).searchParams.get('v')).toBe('a&b=c')
  })
})
