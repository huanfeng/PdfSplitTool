import { create } from 'zustand'
import type { PDFStore, SplitConfig, ConfigSnapshot } from '../types'
import { loadPDFDocument } from '../services/pdfRenderer'

const DEFAULT_CONFIG: SplitConfig = { ratio: 0.5, direction: 'vertical' }
const MAX_HISTORY = 50

function snapshotState(state: PDFStore): ConfigSnapshot {
  return {
    globalConfig: { ...state.globalConfig },
    oddEvenConfig: {
      odd: state.oddEvenConfig.odd ? { ...state.oddEvenConfig.odd } : undefined,
      even: state.oddEvenConfig.even ? { ...state.oddEvenConfig.even } : undefined,
    },
    rangeConfigs: state.rangeConfigs.map(r => ({ ...r, config: { ...r.config } })),
    pageConfigs: Object.fromEntries(
      Object.entries(state.pageConfigs).map(([k, v]) => [k, { ...v }])
    ),
  }
}

function restoreSnapshot(snapshot: ConfigSnapshot) {
  return {
    globalConfig: snapshot.globalConfig,
    oddEvenConfig: snapshot.oddEvenConfig,
    rangeConfigs: snapshot.rangeConfigs,
    pageConfigs: snapshot.pageConfigs,
  }
}

export const usePDFStore = create<PDFStore>((set, get) => ({
  pdfDoc: null,
  pdfBytes: null,
  fileName: '',
  pageCount: 0,
  currentPage: 1,

  mode: 'uniform' as const,
  zoom: 1.0,

  globalConfig: { ...DEFAULT_CONFIG },
  oddEvenConfig: {},
  rangeConfigs: [],
  pageConfigs: {},

  thumbnailCache: {},
  history: [],
  historyIndex: -1,

  loadPDF: async (file: File) => {
    const buffer = await file.arrayBuffer()
    const pdfDoc = await loadPDFDocument(buffer.slice(0))  // 给 pdfjs 传副本，保留原始 buffer
    const initialConfig = { ...DEFAULT_CONFIG }
    const baseSnapshot = {
      globalConfig: { ...initialConfig },
      oddEvenConfig: {},
      rangeConfigs: [],
      pageConfigs: {},
    }
    set({
      pdfDoc,
      pdfBytes: buffer,  // 主线程保留原始（未 detach）
      fileName: file.name,
      pageCount: pdfDoc.numPages,
      currentPage: 1,
      mode: 'uniform' as const,
      zoom: 1.0,
      globalConfig: { ...initialConfig },
      oddEvenConfig: {},
      rangeConfigs: [],
      pageConfigs: {},
      thumbnailCache: {},
      history: [baseSnapshot],
      historyIndex: 0,
    })
  },

  setCurrentPage: (page) => set({ currentPage: page }),

  setMode: (mode) => set({ mode }),
  setZoom: (zoom) => set({ zoom }),

  setGlobalConfig: (config) => set({ globalConfig: config }),
  setOddConfig: (config) => set(s => ({ oddEvenConfig: { ...s.oddEvenConfig, odd: config } })),
  setEvenConfig: (config) => set(s => ({ oddEvenConfig: { ...s.oddEvenConfig, even: config } })),

  addRangeConfig: (from, to, config) =>
    set(s => ({ rangeConfigs: [...s.rangeConfigs, { from, to, config }] })),

  removeRangeConfig: (index) =>
    set(s => ({ rangeConfigs: s.rangeConfigs.filter((_, i) => i !== index) })),

  setPageConfig: (pageNum, config) =>
    set(s => ({ pageConfigs: { ...s.pageConfigs, [pageNum]: config } })),

  applyConfigToAll: (config) =>
    set({ globalConfig: config, oddEvenConfig: {}, rangeConfigs: [], pageConfigs: {} }),

  pushHistory: () => {
    const state = get()
    const snapshot = snapshotState(state)
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push(snapshot)
    const capped = newHistory.length > MAX_HISTORY
      ? newHistory.slice(newHistory.length - MAX_HISTORY)
      : newHistory
    set({ history: capped, historyIndex: capped.length - 1 })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    set({ ...restoreSnapshot(history[newIndex]), historyIndex: newIndex })
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    set({ ...restoreSnapshot(history[newIndex]), historyIndex: newIndex })
  },

  setThumbnailCache: (pageNum, bitmap) =>
    set(s => ({ thumbnailCache: { ...s.thumbnailCache, [pageNum]: bitmap } })),

  reset: () =>
    set({
      pdfDoc: null, pdfBytes: null, fileName: '', pageCount: 0, currentPage: 1,
      mode: 'uniform' as const, zoom: 1.0,
      globalConfig: { ...DEFAULT_CONFIG }, oddEvenConfig: {}, rangeConfigs: [],
      pageConfigs: {}, thumbnailCache: {}, history: [], historyIndex: -1,
    }),
}))
