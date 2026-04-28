import { useEffect, useRef } from 'react'
import { usePDFStore } from '../store/usePDFStore'
import { resolveConfig } from '../services/splitConfigResolver'
import { renderThumbnail } from '../services/pdfRenderer'
import styles from './PageList.module.css'

export function PageList() {
  const {
    pdfDoc, pageCount, currentPage, setCurrentPage,
    thumbnailCache, setThumbnailCache,
    globalConfig, oddEvenConfig, rangeConfigs, pageConfigs,
  } = usePDFStore()

  const snapshot = { globalConfig, oddEvenConfig, rangeConfigs, pageConfigs }

  useEffect(() => {
    if (!pdfDoc) return
    for (let i = 1; i <= pageCount; i++) {
      if (thumbnailCache[i]) continue
      renderThumbnail(pdfDoc, i, 90).then(bitmap => setThumbnailCache(i, bitmap))
    }
  }, [pdfDoc, pageCount])

  if (!pdfDoc) return null

  return (
    <div className={styles.list}>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map(pageNum => {
        const config = resolveConfig(pageNum, snapshot)
        const bitmap = thumbnailCache[pageNum]
        const isActive = pageNum === currentPage
        return (
          <div
            key={pageNum}
            className={`${styles.item} ${isActive ? styles.active : ''}`}
            onClick={() => setCurrentPage(pageNum)}
          >
            <div className={styles.thumb}>
              {bitmap ? (
                <ThumbnailCanvas bitmap={bitmap} config={config} />
              ) : (
                <div className={styles.placeholder}>...</div>
              )}
            </div>
            <span className={styles.pageNum}>{pageNum}</span>
          </div>
        )
      })}
    </div>
  )
}

function ThumbnailCanvas({
  bitmap,
  config,
}: {
  bitmap: ImageBitmap
  config: { ratio: number; direction: 'vertical' | 'horizontal' }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    ctx.drawImage(bitmap, 0, 0)

    // 叠加分割线
    ctx.strokeStyle = '#e94560'
    ctx.lineWidth = Math.max(1, bitmap.width * 0.015)
    ctx.beginPath()
    if (config.direction === 'vertical') {
      const x = bitmap.width * config.ratio
      ctx.moveTo(x, 0)
      ctx.lineTo(x, bitmap.height)
    } else {
      const y = bitmap.height * (1 - config.ratio)
      ctx.moveTo(0, y)
      ctx.lineTo(bitmap.width, y)
    }
    ctx.stroke()
  }, [bitmap, config.ratio, config.direction])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
  )
}
