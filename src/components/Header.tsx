import { useEffect, useRef, useState } from 'react'
import { usePDFStore } from '../store/usePDFStore'
import styles from './Header.module.css'

const APP_VERSION = `v${__APP_VERSION__}`

export function Header() {
  const {
    fileName, pageCount, currentPage, setCurrentPage,
    undo, redo, historyIndex, history, loadPDF, reset,
    theme, setTheme,
  } = usePDFStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pageInputValue, setPageInputValue] = useState(String(currentPage))
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    setPageInputValue(String(currentPage))
  }, [currentPage])

  const handleFile = async (file: File) => {
    if (!file) return
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') return
    try {
      await loadPDF(file)
    } catch (err) {
      console.error('Failed to load PDF:', err)
      alert('无法读取该 PDF 文件，请确认文件格式正确。')
    }
  }

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  if (!fileName) {
    return (
      <header
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
        onDrop={e => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFile(file) }}
        onDragOver={e => e.preventDefault()}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={styles.dropzoneInner}>
          <span className={styles.icon}>📄</span>
          <p>拖放 PDF 文件到此处，或点击选择文件</p>
          <p className={styles.hint}>支持 A3、B4 等宽幅 PDF</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          hidden
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </header>
    )
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.appName}>PDF Splitter</span>
        <span className={styles.version}>{APP_VERSION}</span>
      </div>
      <span className={styles.filename} title={fileName}>{fileName}</span>
      <div className={styles.nav}>
        <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>‹</button>
        <span className={styles.pageInfo}>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={pageInputValue}
            onChange={e => setPageInputValue(e.target.value)}
            onBlur={() => {
              const v = parseInt(pageInputValue)
              if (v >= 1 && v <= pageCount) setCurrentPage(v)
              else setPageInputValue(String(currentPage))
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = parseInt(pageInputValue)
                if (v >= 1 && v <= pageCount) setCurrentPage(v)
                else setPageInputValue(String(currentPage))
              }
            }}
            className={styles.pageInput}
          />
          / {pageCount}
        </span>
        <button onClick={() => setCurrentPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount}>›</button>
      </div>
      <div className={styles.actions}>
        <button onClick={undo} disabled={!canUndo} title="撤销 (Ctrl+Z)">↩ 撤销</button>
        <button onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Y)">↪ 重做</button>
      </div>
      <button onClick={toggleTheme} title={theme === 'dark' ? '切换为亮色' : '切换为暗色'} className={styles.themeBtn}>
        {theme === 'dark' ? '☀' : '🌙'}
      </button>
      <div className={styles.fileActions}>
        <button onClick={() => fileInputRef.current?.click()} title="换一个 PDF 文件">📂 换文件</button>
        <button onClick={() => { if (confirm('确定关闭当前文件吗？')) reset() }} title="关闭文件" className={styles.closeBtn}>✕ 关闭</button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        hidden
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </header>
  )
}
