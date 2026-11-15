import { useState, type ReactElement } from 'react'
import type { ZoneSource } from '@shared/types'

type TimerSource = Extract<ZoneSource, { type: 'timer' }>
type DataSource = Extract<ZoneSource, { type: 'data' }>

const ALIGNS = ['left', 'center', 'right'] as const

const INPUT_CLASS =
  'rounded-md border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-1)]'

function chip(active: boolean): string {
  return `rounded-md border px-3 py-1 text-xs ${
    active
      ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-light)]'
      : 'border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-3)] hover:border-[var(--border-2)]'
  }`
}

function AlignButtons({
  value,
  onChange
}: {
  value: 'left' | 'center' | 'right'
  onChange: (a: 'left' | 'center' | 'right') => void
}): ReactElement {
  return (
    <>
      {ALIGNS.map((a) => (
        <button key={a} onClick={() => onChange(a)} className={`${chip(value === a)} capitalize`}>
          {a}
        </button>
      ))}
    </>
  )
}

const TIMER_MODES: Array<{ value: TimerSource['mode']; label: string }> = [
  { value: 'session', label: 'Session (since app start)' },
  { value: 'countdown', label: 'Countdown to…' },
  { value: 'countup', label: 'Count up from…' }
]

export function TimerEditor({
  source,
  onChange
}: {
  source: TimerSource
  onChange: (patch: Partial<TimerSource>) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {TIMER_MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onChange({ mode: m.value })}
            className={chip(source.mode === m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {source.mode !== 'session' && (
        <input
          type="datetime-local"
          value={source.target ?? ''}
          onChange={(e) => onChange({ target: e.target.value })}
          className={INPUT_CLASS}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={source.label}
          placeholder="Label"
          onChange={(e) => onChange({ label: e.target.value })}
          className={`${INPUT_CLASS} w-40`}
        />
        <input
          type="color"
          value={source.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
        />
        <AlignButtons value={source.align} onChange={(align) => onChange({ align })} />
      </div>
    </div>
  )
}

const DATA_TEMPLATES: Array<{ label: string; hint: string; patch: Partial<DataSource> }> = [
  {
    label: 'Discord server',
    hint: 'Replace INVITE with your server’s invite code (the part after discord.gg/). No login needed.',
    patch: {
      url: 'https://discord.com/api/v9/invites/INVITE?with_counts=true',
      headers: '',
      path: 'approximate_presence_count',
      label: 'Discord online',
      unit: ''
    }
  },
  {
    label: 'Home Assistant',
    hint: 'Replace the host and ENTITY_ID, and paste a long-lived access token (Profile → Security) after “Bearer”.',
    patch: {
      url: 'http://homeassistant.local:8123/api/states/sensor.ENTITY_ID',
      headers: 'Authorization: Bearer YOUR_TOKEN',
      path: 'state',
      label: 'Home Assistant',
      unit: ''
    }
  },
  {
    label: 'Twitch viewers',
    hint: 'Needs a Twitch developer app: put its Client ID and an app access token in the headers, and the channel name in the URL. Shows — while offline.',
    patch: {
      url: 'https://api.twitch.tv/helix/streams?user_login=CHANNEL',
      headers: 'Client-Id: YOUR_CLIENT_ID\nAuthorization: Bearer YOUR_APP_TOKEN',
      path: 'data.0.viewer_count',
      label: 'Twitch viewers',
      unit: ''
    }
  }
]

export function DataEditor({
  source,
  onChange
}: {
  source: DataSource
  onChange: (patch: Partial<DataSource>) => void
}): ReactElement {
  const [hint, setHint] = useState<string | null>(null)
  const [test, setTest] = useState<string | null>(null)

  async function runTest(): Promise<void> {
    setTest('Testing…')
    const r = await window.control.data.get(source.url, source.headers, source.path)
    setTest(r.value != null && !r.error ? `OK: ${r.value}` : `Error: ${r.error ?? 'no value'}`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--text-4)]">Start from</span>
        {DATA_TEMPLATES.map((t) => (
          <button
            key={t.label}
            onClick={() => {
              onChange(t.patch)
              setHint(t.hint)
            }}
            className={chip(false)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {hint && <p className="text-xs text-[var(--text-4)]">{hint}</p>}
      <input
        value={source.url}
        placeholder="https://… (any JSON endpoint)"
        onChange={(e) => onChange({ url: e.target.value })}
        className={INPUT_CLASS}
      />
      <textarea
        value={source.headers}
        placeholder={'Headers, one per line:\nAuthorization: Bearer …'}
        rows={2}
        onChange={(e) => onChange({ headers: e.target.value })}
        className={`${INPUT_CLASS} font-mono`}
      />
      <p className="text-xs text-[var(--text-5)]">
        Headers are saved in your config file in plain text (and included if you export it), so
        treat tokens here like passwords.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={source.path}
          placeholder="Path, e.g. data.0.count"
          onChange={(e) => onChange({ path: e.target.value })}
          className={`${INPUT_CLASS} w-48`}
        />
        <input
          value={source.label}
          placeholder="Label"
          onChange={(e) => onChange({ label: e.target.value })}
          className={`${INPUT_CLASS} w-36`}
        />
        <input
          value={source.unit}
          placeholder="Unit"
          onChange={(e) => onChange({ unit: e.target.value })}
          className={`${INPUT_CLASS} w-20`}
        />
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-3)]">
          Every
          <input
            type="number"
            min={5}
            value={source.intervalSec}
            onChange={(e) => onChange({ intervalSec: Math.max(5, Number(e.target.value) || 30) })}
            className={`${INPUT_CLASS} w-16`}
          />
          s
        </label>
        <input
          type="color"
          value={source.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-7 w-10 rounded border border-[var(--border-1)] bg-transparent"
        />
        <AlignButtons value={source.align} onChange={(align) => onChange({ align })} />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={runTest} className={chip(false)}>
          Test
        </button>
        {test && <span className="text-xs text-[var(--text-3)]">{test}</span>}
      </div>
    </div>
  )
}
