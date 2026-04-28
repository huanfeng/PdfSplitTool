import { useState } from 'react'
import { usePDFStore } from '../store/usePDFStore'
import { resolveConfig } from '../services/splitConfigResolver'
import { splitPDF, splitPDFToPages } from '../services/pdfSplitter'
import { downloadSinglePDF, downloadZIP } from '../services/exportBuilder'
import type { SplitConfig } from '../types'
import styles from './ConfigPanel.module.css'

export function ConfigPanel() {
  const store = usePDFStore()
  const {
    pdfBytes, pageCount, currentPage, fileName,
    globalConfig, oddEvenConfig, rangeConfigs, pageConfigs,
    setOddConfig, setEvenConfig,
    addRangeConfig, setPageConfig, applyConfigToAll, pushHistory,
  } = store

  const snapshot = { globalConfig, oddEvenConfig, rangeConfigs, pageConfigs }
  const config = resolveConfig(currentPage, snapshot)

  const [mode, setMode] = useState<'uniform' | 'oddeven' | 'range' | 'page'>('uniform')
  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(pageCount || 1)
  const [exporting, setExporting] = useState(false)

  const dispatchConfig = (newConfig: SplitConfig) => {
    if (mode === 'uniform') applyConfigToAll(newConfig)
    else if (mode === 'oddeven') {
      if (currentPage % 2 === 1) setOddConfig(newConfig)
      else setEvenConfig(newConfig)
    } else if (mode === 'range') addRangeConfig(rangeFrom, rangeTo, newConfig)
    else setPageConfig(currentPage, newConfig)
    pushHistory()
  }

  const updateRatio = (ratio: number) => {
    const clamped = Math.max(0.05, Math.min(0.95, ratio))
    dispatchConfig({ ...config, ratio: clamped })
  }

  const updateDirection = (direction: SplitConfig['direction']) => {
    dispatchConfig({ ...config, direction })
  }

  const handleExport = async (type: 'single' | 'zip') => {
    if (!pdfBytes || exporting) return
    setExporting(true)
    try {
      const baseName = fileName.replace(/\.pdf$/i, '')
      if (type === 'single') {
        const bytes = await splitPDF(pdfBytes, pageCount, snapshot)
        await downloadSinglePDF(bytes, `${baseName}-split.pdf`)
      } else {
        const pageBytesList = await splitPDFToPages(pdfBytes, pageCount, snapshot)
        const pages = pageBytesList.map((bytes, i) => ({
          filename: `page-${String(i + 1).padStart(3, '0')}.pdf`,
          bytes,
        }))
        await downloadZIP(pages, `${baseName}-split.zip`)
      }
    } catch (err) {
      console.error('Export failed:', err)
      alert('导出失败，请重试。')
    } finally {
      setExporting(false)
    }
  }

  if (!pdfBytes) return null

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h4 className={styles.label}>分割方向</h4>
        <div className={styles.btnGroup}>
          <button
            className={config.direction === 'vertical' ? styles.active : ''}
            onClick={() => updateDirection('vertical')}
          >⟺ 左右</button>
          <button
            className={config.direction === 'horizontal' ? styles.active : ''}
            onClick={() => updateDirection('horizontal')}
          >⇕ 上下</button>
        </div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.label}>批量模式</h4>
        <div className={styles.modeGroup}>
          {(['uniform', 'oddeven', 'range', 'page'] as const).map(m => (
            <button key={m} className={mode === m ? styles.active : ''} onClick={() => setMode(m)}>
              {{ uniform: '统一', oddeven: '奇偶页', range: '页范围', page: '当前页' }[m]}
            </button>
          ))}
        </div>
        {mode === 'range' && (
          <div className={styles.rangeRow}>
            <input type="number" min={1} max={pageCount} value={rangeFrom}
              onChange={e => setRangeFrom(Number(e.target.value))} />
            <span>—</span>
            <input type="number" min={1} max={pageCount} value={rangeTo}
              onChange={e => setRangeTo(Number(e.target.value))} />
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.label}>
          {mode === 'oddeven'
            ? (currentPage % 2 === 1 ? '奇数页比例' : '偶数页比例')
            : '分割比例'}
        </h4>
        <div className={styles.ratioRow}>
          <input
            type="number" min={5} max={95} step={0.5}
            value={(config.ratio * 100).toFixed(1)}
            onChange={e => updateRatio(Number(e.target.value) / 100)}
            className={styles.ratioInput}
          />
          <span className={styles.pct}>%</span>
        </div>
        <input
          type="range" min={5} max={95} step={0.5}
          value={config.ratio * 100}
          onChange={e => updateRatio(Number(e.target.value) / 100)}
          className={styles.slider}
        />
      </section>

      <section className={styles.exportSection}>
        <button className="btn-primary" onClick={() => handleExport('single')} disabled={exporting}>
          {exporting ? '导出中...' : '⬇ 下载单 PDF'}
        </button>
        <button onClick={() => handleExport('zip')} disabled={exporting}>
          {exporting ? '导出中...' : '⬇ 下载 ZIP'}
        </button>
      </section>
    </div>
  )
}
