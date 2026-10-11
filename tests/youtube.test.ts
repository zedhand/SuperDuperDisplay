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
  it('points at the GitHub Pages relay with the video id and starting volume', () => {
    const url = buildYoutubeEmbedRelayUrl('dQw4w9WgXcQ', 40)
    expect(url).toBe(
      'https://zedhand.github.io/superduperdisplay-yt-embed/?v=dQw4w9WgXcQ&volume=40'
    )
  })
})
