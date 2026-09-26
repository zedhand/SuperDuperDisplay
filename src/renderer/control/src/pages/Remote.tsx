import { useEffect, useState, type ReactElement } from 'react'
import { RefreshCw } from 'lucide-react'
import type { RemoteStatus } from '@shared/types'
import { useConfigStore } from '../store/useConfigStore'

export function RemotePage(): ReactElement {
  const config = useConfigStore((s) => s.config)
  const patch = useConfigStore((s) => s.patch)
  const [status, setStatus] = useState<RemoteStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.control.remote.status().then(setStatus)
  }, [config?.remote.enabled, config?.remote.port])

  if (!config) return <div className="p-6 text-white/50">Loading…</div>

  async function toggleEnabled(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setStatus(await window.control.remote.setEnabled(!config!.remote.enabled))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function regenerateToken(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setStatus(await window.control.remote.regenerateToken())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <section className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">LAN remote</h2>
          <button
            onClick={toggleEnabled}
            disabled={busy}
            className={`rounded-md border px-3 py-1.5 text-xs disabled:opacity-50 ${
              config.remote.enabled
                ? 'border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-300'
                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
            }`}
          >
            {config.remote.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <p className="mb-4 text-xs text-white/40">
          Serves a small control page over your local network so you can switch presets or
          blank/unblank the display from a phone or tablet. Reachable only by devices on the same
          LAN, and only with the token below — not exposed to the internet. Windows may prompt for
          firewall access the first time it starts.
        </p>

        <label className="mb-3 flex items-center gap-2 text-sm text-white/80">
          Port
          <input
            type="number"
            min={1024}
            max={65535}
            value={config.remote.port}
            onChange={(e) =>
              patch({
                remote: { ...config.remote, port: Number(e.target.value) || config.remote.port }
              })
            }
            className="w-24 rounded border border-white/10 bg-white/5 px-2 py-1 text-white"
          />
        </label>

        {error && <div className="mb-3 text-xs text-red-400">{error}</div>}

        {config.remote.enabled && status?.running && (
          <div className="flex items-start gap-4">
            {status.qrDataUrl && (
              <img
                src={status.qrDataUrl}
                alt="QR code to pair"
                className="h-40 w-40 rounded-md bg-white p-2"
              />
            )}
            <div className="flex flex-col gap-2">
              <div className="text-xs text-white/40">Scan with your phone, or open:</div>
              <input
                readOnly
                value={status.url}
                onFocus={(e) => e.target.select()}
                className="w-72 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white"
              />
              <button
                onClick={regenerateToken}
                disabled={busy}
                className="flex w-fit items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:border-white/20 disabled:opacity-50"
              >
                <RefreshCw size={14} />
                Regenerate token
              </button>
            </div>
          </div>
        )}

        {config.remote.enabled && !status?.running && !error && (
          <div className="text-xs text-amber-400/80">Starting…</div>
        )}
      </section>
    </div>
  )
}
