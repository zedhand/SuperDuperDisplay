import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getDataValue } from '../src/main/data/jsonValue'

let server: Server
let base = ''
let lastAuth: string | undefined

beforeAll(async () => {
  server = createServer((req, res) => {
    lastAuth = req.headers['authorization']
    if (req.url === '/fail') {
      res.statusCode = 500
      res.end('nope')
    } else if (req.url === '/viewers') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ data: [{ viewer_count: 1234 }] }))
    } else if (req.url === '/ha') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ state: '21.5' }))
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

describe('getDataValue', () => {
  it('reads a nested value', async () => {
    expect(await getDataValue(`${base}/viewers`, '', 'data.0.viewer_count')).toEqual({
      value: '1234'
    })
  })

  it('sends custom headers', async () => {
    const r = await getDataValue(`${base}/ha`, 'Authorization: Bearer abc', 'state')
    expect(r.value).toBe('21.5')
    expect(lastAuth).toBe('Bearer abc')
  })

  it('reports a missing path', async () => {
    const r = await getDataValue(`${base}/ha`, '', 'nothing.here')
    expect(r.value).toBeNull()
    expect(r.error).toMatch(/Nothing at/)
  })

  it('reports HTTP errors', async () => {
    const r = await getDataValue(`${base}/fail`, '', 'x')
    expect(r.error).toBe('HTTP 500')
  })

  it('rejects non-http URLs and garbage', async () => {
    expect((await getDataValue('file:///etc/passwd', '', 'x')).error).toMatch(/http/)
    expect((await getDataValue('not a url', '', 'x')).error).toMatch(/valid URL/)
  })
})
