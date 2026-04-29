import { useEffect } from 'react'
import { usePDFStore } from './store/usePDFStore'
import { Header } from './components/Header'
import { LandingPage } from './components/LandingPage'
import { PageList } from './components/PageList'
import { SplitCanvas } from './components/SplitCanvas'
import { ConfigPanel } from './components/ConfigPanel'
import './App.css'

function App() {
  const { fileName, undo, redo, theme } = usePDFStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  if (!fileName) {
    return <LandingPage />
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
