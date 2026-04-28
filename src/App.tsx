import { useEffect } from 'react'
import { usePDFStore } from './store/usePDFStore'
import { Header } from './components/Header'
import { PageList } from './components/PageList'
import { SplitCanvas } from './components/SplitCanvas'
import { ConfigPanel } from './components/ConfigPanel'
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
      <SplitCanvas />
      <ConfigPanel />
    </div>
  )
}

export default App
