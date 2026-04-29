import { useRef, useState } from 'react'
import { usePDFStore } from '../store/usePDFStore'
import styles from './LandingPage.module.css'

export function LandingPage() {
  const { loadPDF } = usePDFStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') return
    try {
      await loadPDF(file)
    } catch (err) {
      console.error('Failed to load PDF:', err)
      alert('无法读取该 PDF 文件，请确认文件格式正确。')
    }
  }

  return (
    <div
      className={`${styles.page} ${isDragging ? styles.dragging : ''}`}
      onDragOver={e => e.preventDefault()}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false) }}
      onDrop={e => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
    >
      <div className={styles.hero}>
        <div className={styles.logoArea}>
          <span className={styles.logoIcon}>✂</span>
          <h1 className={styles.title}>PDF 分割工具</h1>
        </div>
        <p className={styles.subtitle}>纯浏览器端处理 · 无需上传 · 文件不离开你的设备</p>

        <div className={styles.uploadCard}>
          <p className={styles.uploadLabel}>选择或拖入 PDF 文件开始使用</p>
          <button
            className={styles.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            选择 PDF 文件
          </button>
          <p className={styles.dropHint}>支持直接将文件拖放到此处或页面任意位置</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            hidden
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>✂️</span>
            <div>
              <div className={styles.featureName}>可视化分割</div>
              <div className={styles.featureDesc}>拖动分割线实时预览，精确到 0.1%，支持左右 / 上下两种方向</div>
            </div>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>📐</span>
            <div>
              <div className={styles.featureName}>A3 → A4 分割</div>
              <div className={styles.featureDesc}>CropBox 元数据裁切，保留完整矢量质量，不光栅化</div>
            </div>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>📋</span>
            <div>
              <div className={styles.featureName}>分级批量配置</div>
              <div className={styles.featureDesc}>统一比例 / 奇偶页 / 页范围 / 逐页，四层优先级覆盖</div>
            </div>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>📦</span>
            <div>
              <div className={styles.featureName}>灵活导出</div>
              <div className={styles.featureDesc}>合并为单个 PDF 或按页 ZIP 打包下载，支持撤销 / 重做</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
