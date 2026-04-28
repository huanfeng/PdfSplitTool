import { useRef } from 'react'
import { usePDFStore } from '../store/usePDFStore'
import styles from './Header.module.css'

export function Header() {
  const { fileName, pageCount, currentPage, setCurrentPage, undo, redo, historyIndex, history, loadPDF } =
    usePDFStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file || !file.name.endsWith('.pdf')) return
    await loadPDF(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  if (!fileName) {
    return (
      <header
        className={styles.dropzone}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
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
            value={currentPage}
            onChange={e => {
              const v = parseInt(e.target.value)
              if (v >= 1 && v <= pageCount) setCurrentPage(v)
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
