import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface SplitConfig {
  ratio: number            // 0.0 ~ 1.0，分割线相对于页面宽/高的位置
  direction: 'vertical' | 'horizontal'  // vertical=左右分(竖线), horizontal=上下分(横线)
}

export interface RangeConfig {
  from: number   // 1-based，起始页
  to: number     // 1-based，结束页（含）
  config: SplitConfig
}

export interface ConfigSnapshot {
  globalConfig: SplitConfig
  oddEvenConfig: { odd?: SplitConfig; even?: SplitConfig }
  rangeConfigs: RangeConfig[]
  pageConfigs: Record<number, SplitConfig>  // key: 1-based page number
}

export interface PDFState {
  pdfDoc: PDFDocumentProxy | null
  pdfBytes: ArrayBuffer | null
  fileName: string
  pageCount: number
  currentPage: number    // 1-based

  globalConfig: SplitConfig
  oddEvenConfig: { odd?: SplitConfig; even?: SplitConfig }
  rangeConfigs: RangeConfig[]
  pageConfigs: Record<number, SplitConfig>

  thumbnailCache: Record<number, ImageBitmap>

  history: ConfigSnapshot[]
  historyIndex: number
}

export interface PDFActions {
  loadPDF: (file: File) => Promise<void>
  setCurrentPage: (page: number) => void
  setGlobalConfig: (config: SplitConfig) => void
  setOddConfig: (config: SplitConfig) => void
  setEvenConfig: (config: SplitConfig) => void
  addRangeConfig: (from: number, to: number, config: SplitConfig) => void
  removeRangeConfig: (index: number) => void
  setPageConfig: (pageNum: number, config: SplitConfig) => void
  applyConfigToAll: (config: SplitConfig) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  setThumbnailCache: (pageNum: number, bitmap: ImageBitmap) => void
  reset: () => void
}

export type PDFStore = PDFState & PDFActions
