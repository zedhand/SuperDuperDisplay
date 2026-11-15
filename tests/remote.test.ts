import { describe, expect, it } from 'vitest'
import { isSameOrigin } from '../src/main/remote/server'

describe('isSameOrigin', () => {
  it('allows clients that send no Origin', () => {
    expect(isSameOrigin(undefined, '192.168.1.5:8787')).toBe(true)
  })
  it('allows a matching host', () => {
    expect(isSameOrigin('http://192.168.1.5:8787', '192.168.1.5:8787')).toBe(true)
  })
  it('rejects another site', () => {
    expect(isSameOrigin('https://evil.example', '192.168.1.5:8787')).toBe(false)
  })
  it('rejects garbage', () => {
    expect(isSameOrigin('not a url', '192.168.1.5:8787')).toBe(false)
  })
})
