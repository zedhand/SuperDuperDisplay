import { useEffect, useState, type ReactElement } from 'react'
import { Sidebar, type PageId } from './components/Sidebar'
import { DisplaysPage } from './pages/Displays'
import { ScenesPage } from './pages/Scenes'
import { LayoutPage } from './pages/Layout'
import { ColorPage } from './pages/Color'
import { TriggersPage } from './pages/Triggers'
import { SettingsPage } from './pages/Settings'
import { ComingSoonPage } from './pages/ComingSoon'
import { initConfigStore } from './store/useConfigStore'

const COMING_SOON: Partial<Record<PageId, string>> = {
  remote: 'Phase 4 — Automation and integration'
}

const PAGE_COMPONENTS: Partial<Record<PageId, () => ReactElement>> = {
  displays: DisplaysPage,
  scenes: ScenesPage,
  layout: LayoutPage,
  color: ColorPage,
  triggers: TriggersPage,
  settings: SettingsPage
}

function App(): ReactElement {
  const [page, setPage] = useState<PageId>('displays')

  useEffect(() => {
    initConfigStore()
  }, [])

  const PageComponent = PAGE_COMPONENTS[page]

  return (
    <div className="flex h-screen w-screen bg-[#0b0b0f]">
      <Sidebar active={page} onSelect={setPage} />
      <main className="flex-1 overflow-y-auto">
        {PageComponent ? (
          <PageComponent />
        ) : (
          <ComingSoonPage title={page} phase={COMING_SOON[page] ?? 'a later phase'} />
        )}
      </main>
    </div>
  )
}

export default App
