import { useEffect, useRef, useState } from 'react'
import { usePDFStore } from '../store/usePDFStore'
import styles from './Header.module.css'

export function Header() {
  const { fileName, pageCount, currentPage, setCurrentPage, undo, redo, historyIndex, history, loadPDF, zoom, setZoom } =
    usePDFStore()
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
      <div className={styles.zoomBar}>
        <button className={styles.zoomBtn} onClick={() => setZoom(Math.max(0.5, parseFloat((zoom - 0.25).toFixed(2))))} disabled={zoom <= 0.5}>−</button>
        <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
        <button className={styles.zoomBtn} onClick={() => setZoom(Math.min(3, parseFloat((zoom + 0.25).toFixed(2))))} disabled={zoom >= 3}>+</button>
        <button className={styles.zoomBtn} onClick={() => setZoom(1)} title="重置">↺</button>
      </div>
      <button
        onClick={() => fileInputRef.current?.click()}
        title="重新选择文件"
        style={{ marginLeft: 'auto' }}
      >
        📂 换文件
      </button>
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
