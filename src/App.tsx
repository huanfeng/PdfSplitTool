import { useEffect } from 'react'
import { usePDFStore } from './store/usePDFStore'
import { Header } from './components/Header'
import { PageList } from './components/PageList'
import './App.css'

function App() {
  const { fileName, undo, redo } = usePDFStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  if (!fileName) {
    return (
      <div style={{ height: '100vh', background: 'var(--bg-deep)' }}>
        <Header />
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Header />
      <PageList />
      <div style={{ gridArea: 'canvas', background: 'var(--bg-deep)' }}>
        {/* Task 9: SplitCanvas */}
      </div>
      <div style={{ gridArea: 'config', background: 'var(--bg-base)', borderLeft: '1px solid var(--border)' }}>
        {/* Task 10: ConfigPanel */}
      </div>
    </div>
  )
}

export default App
