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
    mode, setMode,
    setOddConfig, setEvenConfig,
    addRangeConfig, removeRangeConfig, setPageConfig, applyConfigToAll, pushHistory,
    renderQuality, setRenderQuality,
    resetConfig,
  } = store

  const snapshot = { globalConfig, oddEvenConfig, rangeConfigs, pageConfigs }
  const config = resolveConfig(currentPage, snapshot)

  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(pageCount || 1)
  const [exporting, setExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

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
    dispatchConfig({ ...config, ratio: Math.max(0.05, Math.min(0.95, ratio)) })
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
      setExportSuccess(type === 'single' ? 'PDF 已下载' : 'ZIP 已下载')
      setTimeout(() => setExportSuccess(null), 2500)
    } catch (err) {
      console.error('Export failed:', err)
      alert('导出失败，请重试。')
    } finally {
      setExporting(false)
    }
  }

  if (!pdfBytes) return null

  const oddCfg = oddEvenConfig.odd ?? globalConfig
  const evenCfg = oddEvenConfig.even ?? globalConfig

  return (
    <div className={styles.panel}>

      {/* 分割方向 */}
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

      {/* 批量模式 */}
      <section className={styles.section}>
        <h4 className={styles.label}>批量模式</h4>
        <div className={styles.modeGrid}>
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

      {/* 分割比例 */}
      {mode === 'oddeven' ? (
        <section className={styles.section}>
          <h4 className={styles.label}>奇偶页比例</h4>
          {[
            { label: '奇数页', parity: 1, cfg: oddCfg, setter: setOddConfig },
            { label: '偶数页', parity: 0, cfg: evenCfg, setter: setEvenConfig },
          ].map(({ label, parity, cfg, setter }) => {
            const isActive = currentPage % 2 === parity
            return (
              <div key={label} className={`${styles.parityRow} ${isActive ? styles.parityActive : ''}`}>
                <span className={styles.parityLabel}>{label}</span>
                <input
                  type="number" min={5} max={95} step={0.5}
                  value={(cfg.ratio * 100).toFixed(1)}
                  onChange={e => {
                    const r = Math.max(0.05, Math.min(0.95, Number(e.target.value) / 100))
                    setter({ ...cfg, ratio: r })
                    pushHistory()
                  }}
                  className={styles.ratioInputSm}
                />
                <span className={styles.pct}>%</span>
              </div>
            )
          })}
        </section>
      ) : (
        <section className={styles.section}>
          <h4 className={styles.label}>
            {mode === 'page' ? `第 ${currentPage} 页比例` : '分割比例'}
          </h4>
          <div className={styles.ratioRow}>
            <input
              key={`ratio-num-${currentPage}`}
              type="number" min={5} max={95} step={0.5}
              value={(config.ratio * 100).toFixed(1)}
              onChange={e => updateRatio(Number(e.target.value) / 100)}
              className={styles.ratioInput}
            />
            <span className={styles.pct}>%</span>
          </div>
          <input
            key={`ratio-range-${currentPage}`}
            type="range" min={5} max={95} step={0.5}
            value={config.ratio * 100}
            onChange={e => updateRatio(Number(e.target.value) / 100)}
            className={styles.slider}
          />
          {mode === 'page' && Object.keys(pageConfigs).length > 0 && (
            <div className={styles.chipList}>
              {Object.entries(pageConfigs).map(([p, cfg]) => (
                <span
                  key={p}
                  className={`${styles.chip} ${Number(p) === currentPage ? styles.chipActive : ''}`}
                  onClick={() => store.setCurrentPage(Number(p))}
                  title={`跳转到第 ${p} 页`}
                >
                  P{p}: {(cfg.ratio * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          )}
          {mode === 'range' && rangeConfigs.length > 0 && (
            <div className={styles.chipList}>
              {rangeConfigs.map((rc, i) => {
                const inRange = currentPage >= rc.from && currentPage <= rc.to
                return (
                  <span
                    key={i}
                    className={`${styles.chip} ${inRange ? styles.chipActive : ''}`}
                    onClick={() => removeRangeConfig(i)}
                    title="点击删除此范围配置"
                  >
                    P{rc.from}–{rc.to}: {(rc.config.ratio * 100).toFixed(0)}% ✕
                  </span>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* 预览质量 */}
      <section className={styles.section}>
        <h4 className={styles.label}>预览质量</h4>
        <div className={styles.btnGroup}>
          <button className={renderQuality === 1 ? styles.active : ''} onClick={() => setRenderQuality(1)}>标准</button>
          <button className={renderQuality === 2 ? styles.active : ''} onClick={() => setRenderQuality(2)}>高清 2×</button>
        </div>
      </section>

      {/* 导出 */}
      <section className={styles.exportSection}>
        <button className="btn-primary" onClick={() => handleExport('single')} disabled={exporting}>
          {exporting ? '导出中...' : '⬇ 下载单 PDF'}
        </button>
        <button onClick={() => handleExport('zip')} disabled={exporting}>
          {exporting ? '导出中...' : '⬇ 下载 ZIP'}
        </button>
        {exportSuccess && (
          <p className={styles.successMsg}>✓ {exportSuccess}</p>
        )}
        <button
          className={styles.resetBtn}
          onClick={() => { if (confirm('确定重置所有分割配置吗？')) resetConfig() }}
        >
          ↺ 重置配置
        </button>
      </section>
    </div>
  )
}
