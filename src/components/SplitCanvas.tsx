import { useEffect, useRef, useState, useCallback } from 'react'
import { usePDFStore } from '../store/usePDFStore'
import { resolveConfig } from '../services/splitConfigResolver'
import { renderPageToCanvas } from '../services/pdfRenderer'
import styles from './SplitCanvas.module.css'

export function SplitCanvas() {
  const {
    pdfDoc, currentPage,
    globalConfig, oddEvenConfig, rangeConfigs, pageConfigs,
    setPageConfig, pushHistory,
  } = usePDFStore()

  const snapshot = { globalConfig, oddEvenConfig, rangeConfigs, pageConfigs }
  const config = resolveConfig(currentPage, snapshot)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [dragRatio, setDragRatio] = useState<number | null>(null)

  const effectiveRatio = dragRatio ?? config.ratio
  const isVertical = config.direction === 'vertical'

  // 渲染当前页
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return
    const containerW = containerRef.current.clientWidth - 32
    const { promise, cancel } = renderPageToCanvas(pdfDoc, currentPage, canvasRef.current, containerW)
    promise.then(() => {
      if (canvasRef.current) {
        setCanvasSize({ w: canvasRef.current.width, h: canvasRef.current.height })
      }
    }).catch(() => {})
    return cancel
  }, [pdfDoc, currentPage])

  // 键盘微调
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
      const step = e.shiftKey ? 0.05 : 0.005
      const current = config.ratio
      let newRatio = current
      if (isVertical && e.key === 'ArrowLeft') newRatio = current - step
      if (isVertical && e.key === 'ArrowRight') newRatio = current + step
      if (!isVertical && e.key === 'ArrowUp') newRatio = current - step
      if (!isVertical && e.key === 'ArrowDown') newRatio = current + step
      newRatio = Math.max(0.05, Math.min(0.95, newRatio))
      if (newRatio !== current) {
        setPageConfig(currentPage, { ...config, ratio: newRatio })
        pushHistory()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [config, currentPage, isVertical])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const svg = e.currentTarget.closest('svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()

    const onMove = (ev: MouseEvent) => {
      let ratio: number
      if (isVertical) {
        ratio = (ev.clientX - rect.left) / rect.width
      } else {
        ratio = (ev.clientY - rect.top) / rect.height
      }
      setDragRatio(Math.max(0.05, Math.min(0.95, ratio)))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDragRatio(prev => {
        if (prev !== null) {
          setPageConfig(currentPage, { ...config, ratio: prev })
          pushHistory()
        }
        return null
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [isVertical, config, currentPage])

  if (!pdfDoc) return null

  const lineX = isVertical ? canvasSize.w * effectiveRatio : 0
  const lineY = isVertical ? 0 : canvasSize.h * effectiveRatio
  const lineX2 = isVertical ? lineX : canvasSize.w
  const lineY2 = isVertical ? canvasSize.h : lineY
  const handleX = isVertical ? lineX : canvasSize.w / 2
  const handleY = isVertical ? canvasSize.h / 2 : lineY

  const leftPct = (effectiveRatio * 100).toFixed(1)
  const rightPct = ((1 - effectiveRatio) * 100).toFixed(1)

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.wrapper}>
        <canvas ref={canvasRef} className={styles.canvas} />
        {canvasSize.w > 0 && (
          <svg
            className={styles.overlay}
            width={canvasSize.w}
            height={canvasSize.h}
            style={{ cursor: isVertical ? 'ew-resize' : 'ns-resize' }}
          >
            <line
              x1={lineX} y1={lineY} x2={lineX2} y2={lineY2}
              stroke="#e94560" strokeWidth={2}
              filter="drop-shadow(0 0 4px #e94560)"
            />
            <circle
              cx={handleX} cy={handleY} r={10}
              fill="#e94560" stroke="#fff" strokeWidth={2}
              style={{ cursor: isVertical ? 'ew-resize' : 'ns-resize' }}
              onMouseDown={startDrag}
            />
            {/* 比例标注 */}
            {isVertical ? (
              <>
                <text x={lineX / 2} y={canvasSize.h - 8} textAnchor="middle" fill="#e94560" fontSize={12}>{leftPct}%</text>
                <text x={lineX + (canvasSize.w - lineX) / 2} y={canvasSize.h - 8} textAnchor="middle" fill="#e94560" fontSize={12}>{rightPct}%</text>
              </>
            ) : (
              <>
                <text x={8} y={lineY / 2} dominantBaseline="middle" fill="#e94560" fontSize={12}>{leftPct}%</text>
                <text x={8} y={lineY + (canvasSize.h - lineY) / 2} dominantBaseline="middle" fill="#e94560" fontSize={12}>{rightPct}%</text>
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  )
}
