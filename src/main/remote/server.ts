import { randomBytes, timingSafeEqual } from 'crypto'
import { createServer, type Server } from 'http'
import { networkInterfaces } from 'os'
import express from 'express'
import { WebSocket, WebSocketServer } from 'ws'
import QRCode from 'qrcode'
import type { AppConfig, DisplayMode, RemoteStatus } from '@shared/types'

const MODES: DisplayMode[] = ['live', 'black', 'hidden']

export function generateRemoteToken(): string {
  return randomBytes(9).toString('base64url')
}

function safeTokenEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// VPN/virtual-switch adapters commonly show up as a non-internal IPv4 too
// (Tailscale, Hyper-V's default switch, etc), but a phone on the same Wi-Fi
// almost never shares that network — only the real uplink is reachable from
// it. Filtered by interface name since that's all Node exposes here.
const VIRTUAL_ADAPTER_NAME_PATTERN =
  /tailscale|zerotier|wireguard|openvpn|hamachi|vethernet|virtualbox|vmware|docker|wsl|npcap|ppp/i

function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4) return false
  const [a, b] = parts
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

/**
 * Best-effort guess at "the address a phone on the same Wi-Fi would use to
 * reach this machine": skips VPN/virtual adapters by name, and prefers a
 * plain "Ethernet"/"Wi-Fi" adapter on a standard private range over a
 * numbered secondary one (which is often a virtual host-only adapter that
 * happens not to match the name filter, e.g. VirtualBox's "Ethernet 3").
 */
function getLanAddress(): string {
  const candidates: Array<{ address: string; score: number }> = []
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (VIRTUAL_ADAPTER_NAME_PATTERN.test(name)) continue
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue
      let score = 0
      if (/^(Wi-Fi|Ethernet)$/i.test(name)) score += 2
      if (isPrivateIPv4(addr.address)) score += 1
      candidates.push({ address: addr.address, score })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  if (candidates.length > 0) return candidates[0].address

  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return '127.0.0.1'
}

function buildStateMessage(config: AppConfig): string {
  return JSON.stringify({
    type: 'state',
    presets: config.presets.map((p) => ({ id: p.id, name: p.name })),
    activePresetId: config.activePresetId,
    mode: config.display.mode
  })
}

function renderRemotePage(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MiniDisplay Remote</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b0b0f; color: #fff; font-family: system-ui, sans-serif; padding: 24px 16px; }
  h1 { font-size: 1.1rem; margin: 0 0 20px; color: rgba(255,255,255,0.7); }
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); margin: 24px 0 10px; }
  .grid { display: flex; flex-direction: column; gap: 8px; }
  button {
    appearance: none; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.8); padding: 14px; border-radius: 10px; font-size: 0.95rem; text-align: left;
  }
  button.active { border-color: rgba(232,121,249,0.6); background: rgba(217,70,239,0.1); color: rgb(240,171,252); }
  #status { font-size: 0.75rem; color: rgba(255,255,255,0.3); margin-top: 24px; }
</style>
</head>
<body>
  <h1>MiniDisplay Remote</h1>
  <h2>Presets</h2>
  <div class="grid" id="presets"></div>
  <h2>Mode</h2>
  <div class="grid" id="modes"></div>
  <div id="status">Connecting…</div>
<script>
(function () {
  var token = new URLSearchParams(location.search).get('token') || '';
  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var ws = new WebSocket(proto + '//' + location.host + '/ws?token=' + encodeURIComponent(token));
  var presetsEl = document.getElementById('presets');
  var modesEl = document.getElementById('modes');
  var statusEl = document.getElementById('status');
  var MODES = ['live', 'black', 'hidden'];

  ws.onopen = function () { statusEl.textContent = 'Connected'; };
  ws.onclose = function () { statusEl.textContent = 'Disconnected'; };
  ws.onerror = function () { statusEl.textContent = 'Connection error'; };
  ws.onmessage = function (event) {
    var msg = JSON.parse(event.data);
    if (msg.type === 'state') render(msg);
  };

  function render(state) {
    presetsEl.innerHTML = '';
    state.presets.forEach(function (p) {
      var btn = document.createElement('button');
      btn.textContent = p.name;
      if (p.id === state.activePresetId) btn.className = 'active';
      btn.onclick = function () { ws.send(JSON.stringify({ type: 'setPreset', presetId: p.id })); };
      presetsEl.appendChild(btn);
    });

    modesEl.innerHTML = '';
    MODES.forEach(function (mode) {
      var btn = document.createElement('button');
      btn.textContent = mode[0].toUpperCase() + mode.slice(1);
      if (mode === state.mode) btn.className = 'active';
      btn.onclick = function () { ws.send(JSON.stringify({ type: 'setMode', mode: mode })); };
      modesEl.appendChild(btn);
    });
  }
})();
</script>
</body>
</html>`
}

/**
 * LAN-only web remote: a tiny express page + websocket, gated by a random
 * token (config.remote.token). Not meant to survive being port-forwarded to
 * the internet — it's scoped to "someone on the same Wi-Fi with the QR code
 * or URL", not a hardened multi-tenant auth story.
 */
export class RemoteServer {
  private httpServer: Server | null = null
  private wss: WebSocketServer | null = null
  private clients = new Set<WebSocket>()
  private getConfig: () => AppConfig
  private onSetPreset: (presetId: string) => void
  private onSetMode: (mode: DisplayMode) => void

  constructor(
    getConfig: () => AppConfig,
    onSetPreset: (presetId: string) => void,
    onSetMode: (mode: DisplayMode) => void
  ) {
    this.getConfig = getConfig
    this.onSetPreset = onSetPreset
    this.onSetMode = onSetMode
  }

  get running(): boolean {
    return this.httpServer !== null
  }

  /** Restarts on any change while enabled (cheap, and the only way to pick up a new port/token). */
  async applyConfig(remote: AppConfig['remote']): Promise<void> {
    if (this.running) this.stop()
    if (remote.enabled) await this.start(remote.port, remote.token)
  }

  async status(): Promise<RemoteStatus> {
    const remote = this.getConfig().remote
    const url = `http://${getLanAddress()}:${remote.port}/?token=${remote.token}`
    const qrDataUrl = remote.token ? await QRCode.toDataURL(url) : ''
    return { running: this.running, url, token: remote.token, qrDataUrl }
  }

  broadcastState(config: AppConfig): void {
    if (this.clients.size === 0) return
    const payload = buildStateMessage(config)
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload)
    }
  }

  private start(port: number, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const app = express()

      app.get('/', (req, res) => {
        const provided = typeof req.query.token === 'string' ? req.query.token : ''
        if (!token || !safeTokenEquals(provided, token)) {
          res.status(403).type('text/plain').send('Forbidden: missing or incorrect token')
          return
        }
        res.type('html').send(renderRemotePage())
      })

      const httpServer = createServer(app)
      const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

      wss.on('connection', (ws, req) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        const provided = url.searchParams.get('token') ?? ''
        if (!token || !safeTokenEquals(provided, token)) {
          ws.close(4001, 'bad token')
          return
        }

        this.clients.add(ws)
        ws.send(buildStateMessage(this.getConfig()))

        ws.on('message', (data) => {
          let msg: unknown
          try {
            msg = JSON.parse(data.toString())
          } catch {
            return
          }
          if (typeof msg !== 'object' || msg === null || !('type' in msg)) return
          const { type } = msg as { type: unknown }

          if (type === 'setPreset' && 'presetId' in msg && typeof msg.presetId === 'string') {
            this.onSetPreset(msg.presetId)
          } else if (
            type === 'setMode' &&
            'mode' in msg &&
            MODES.includes(msg.mode as DisplayMode)
          ) {
            this.onSetMode(msg.mode as DisplayMode)
          }
        })

        ws.on('close', () => this.clients.delete(ws))
      })

      httpServer.once('error', reject)
      httpServer.listen(port, () => {
        httpServer.removeListener('error', reject)
        this.httpServer = httpServer
        this.wss = wss
        resolve()
      })
    })
  }

  stop(): void {
    for (const client of this.clients) client.close()
    this.clients.clear()
    this.wss?.close()
    this.wss = null
    this.httpServer?.close()
    this.httpServer = null
  }
}
