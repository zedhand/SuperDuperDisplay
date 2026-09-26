import { useEffect, useState, type ReactElement } from 'react'
import { Sidebar, type PageId } from './components/Sidebar'
import { DisplaysPage } from './pages/Displays'
import { ScenesPage } from './pages/Scenes'
import { ComingSoonPage } from './pages/ComingSoon'
import { initConfigStore } from './store/useConfigStore'

const COMING_SOON: Partial<Record<PageId, string>> = {
  layout: 'Phase 2 — Media engine',
  color: 'Phase 3 — Telemetry and post-processing',
  triggers: 'Phase 4 — Automation and integration',
  remote: 'Phase 4 — Automation and integration',
  settings: 'Phase 4 — Automation and integration'
}

function App(): ReactElement {
  const [page, setPage] = useState<PageId>('displays')

  useEffect(() => {
    initConfigStore()
  }, [])

  return (
    <div className="flex h-screen w-screen bg-[#0b0b0f]">
      <Sidebar active={page} onSelect={setPage} />
      <main className="flex-1 overflow-y-auto">
        {page === 'displays' ? (
          <DisplaysPage />
        ) : page === 'scenes' ? (
          <ScenesPage />
        ) : (
          <ComingSoonPage title={page} phase={COMING_SOON[page] ?? 'a later phase'} />
        )}
      </main>
    </div>
  )
}

export default App
