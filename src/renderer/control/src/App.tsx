import { useEffect, useState, type ReactElement } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Sidebar, type PageId } from './components/Sidebar'
import { ScenePreview } from './components/ScenePreview'
import { computeAccentVars } from './lib/accent'
import { computeThemeVars } from './lib/theme'
import { DisplaysPage } from './pages/Displays'
import { ScenesPage } from './pages/Scenes'
import { LayoutPage } from './pages/Layout'
import { ColorPage } from './pages/Color'
import { TriggersPage } from './pages/Triggers'
import { RemotePage } from './pages/Remote'
import { SettingsPage } from './pages/Settings'
import { ComingSoonPage } from './pages/ComingSoon'
import { UndoToast } from './components/UndoToast'
import { initConfigStore, useConfigStore } from './store/useConfigStore'

const COMING_SOON: Partial<Record<PageId, string>> = {}

const PAGE_COMPONENTS: Partial<Record<PageId, () => ReactElement>> = {
  displays: DisplaysPage,
  scenes: ScenesPage,
  layout: LayoutPage,
  color: ColorPage,
  triggers: TriggersPage,
  remote: RemotePage,
  settings: SettingsPage
}

function App(): ReactElement {
  const [page, setPage] = useState<PageId>('displays')
  const [previewOpen, setPreviewOpen] = useState(true)
  const config = useConfigStore((s) => s.config)

  useEffect(() => {
    initConfigStore()
  }, [])

  const PageComponent = PAGE_COMPONENTS[page]

  return (
    <div
      className="flex h-screen w-screen bg-[var(--bg-app)]"
      style={
        config
          ? {
              ...computeThemeVars(config.app.theme),
              ...computeAccentVars(config.app.accentColor, config.app.theme)
            }
          : undefined
      }
    >
      <Sidebar active={page} onSelect={setPage} />
      <main className="flex-1 overflow-y-auto">
        {PageComponent ? (
          <PageComponent />
        ) : (
          <ComingSoonPage title={page} phase={COMING_SOON[page] ?? 'a later phase'} />
        )}
      </main>
      {previewOpen ? (
        <aside className="flex w-72 flex-col gap-3 border-l border-[var(--border-1)] bg-[var(--surface-0)] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-5)]">
              Preview
            </h2>
            <button
              onClick={() => setPreviewOpen(false)}
              className="rounded p-1 text-[var(--text-4)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
              title="Collapse preview"
            >
              <PanelRightClose size={16} />
            </button>
          </div>
          {config ? (
            <ScenePreview config={config} />
          ) : (
            <p className="text-xs text-[var(--text-5)]">Loading…</p>
          )}
        </aside>
      ) : (
        <button
          onClick={() => setPreviewOpen(true)}
          className="flex w-8 items-center justify-center border-l border-[var(--border-1)] bg-[var(--surface-0)] text-[var(--text-4)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]"
          title="Show preview"
        >
          <PanelRightOpen size={16} />
        </button>
      )}
      <UndoToast />
    </div>
  )
}

export default App
