import { create } from 'zustand'
import type { PDFStore, SplitConfig, ConfigSnapshot } from '../types'
import { loadPDFDocument } from '../services/pdfRenderer'

const DEFAULT_CONFIG: SplitConfig = { ratio: 0.5, direction: 'vertical' }
const MAX_HISTORY = 50
const STORAGE_KEY = 'pdf-split-config'

type PersistedConfig = {
  mode: PDFStore['mode']
  globalConfig: SplitConfig
  oddEvenConfig: { odd?: SplitConfig; even?: SplitConfig }
  renderQuality: 1 | 2
  theme: 'dark' | 'light'
  lastFileName: string
}

function saveToStorage(data: PersistedConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function loadFromStorage(): PersistedConfig | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function persistFromState(s: PDFStore, override: Partial<PersistedConfig> = {}) {
  saveToStorage({
    mode: s.mode,
    globalConfig: s.globalConfig,
    oddEvenConfig: s.oddEvenConfig,
    renderQuality: s.renderQuality,
    theme: s.theme,
    lastFileName: s.lastFileName,
    ...override,
  })
}

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

const saved = loadFromStorage()

export const usePDFStore = create<PDFStore>((set, get) => ({
  pdfDoc: null,
  pdfBytes: null,
  fileName: '',
  pageCount: 0,
  currentPage: 1,

  mode: saved?.mode ?? ('uniform' as const),
  zoom: 1.0,
  renderQuality: saved?.renderQuality ?? 1,
  theme: saved?.theme ?? 'dark',
  lastFileName: saved?.lastFileName ?? '',

  globalConfig: saved?.globalConfig ?? { ...DEFAULT_CONFIG },
  oddEvenConfig: saved?.oddEvenConfig ?? {},
  rangeConfigs: [],
  pageConfigs: {},

  thumbnailCache: {},
  history: [],
  historyIndex: -1,

  loadPDF: async (file: File) => {
    const buffer = await file.arrayBuffer()
    const pdfDoc = await loadPDFDocument(buffer.slice(0))
    const restored = loadFromStorage()
    const initialGlobalConfig = restored?.globalConfig ?? { ...DEFAULT_CONFIG }
    const initialOddEvenConfig = restored?.oddEvenConfig ?? {}
    const initialMode = restored?.mode ?? ('uniform' as const)
    const baseSnapshot: ConfigSnapshot = {
      globalConfig: { ...initialGlobalConfig },
      oddEvenConfig: { ...initialOddEvenConfig },
      rangeConfigs: [],
      pageConfigs: {},
    }
    set({
      pdfDoc,
      pdfBytes: buffer,
      fileName: file.name,
      lastFileName: file.name,
      pageCount: pdfDoc.numPages,
      currentPage: 1,
      mode: initialMode,
      zoom: 1.0,
      globalConfig: { ...initialGlobalConfig },
      oddEvenConfig: { ...initialOddEvenConfig },
      rangeConfigs: [],
      pageConfigs: {},
      thumbnailCache: {},
      history: [baseSnapshot],
      historyIndex: 0,
    })
    persistFromState(get(), { lastFileName: file.name })
  },

  setCurrentPage: (page) => set({ currentPage: page }),

  setMode: (mode) => {
    set({ mode })
    persistFromState(get())
  },
  setZoom: (zoom) => set({ zoom }),
  setRenderQuality: (renderQuality) => {
    set({ renderQuality })
    persistFromState(get())
  },
  setTheme: (theme) => {
    set({ theme })
    persistFromState(get())
  },

  setGlobalConfig: (config) => {
    set({ globalConfig: config })
    persistFromState(get())
  },
  setOddConfig: (config) => {
    set(s => ({ oddEvenConfig: { ...s.oddEvenConfig, odd: config } }))
    persistFromState(get())
  },
  setEvenConfig: (config) => {
    set(s => ({ oddEvenConfig: { ...s.oddEvenConfig, even: config } }))
    persistFromState(get())
  },

  addRangeConfig: (from, to, config) =>
    set(s => ({ rangeConfigs: [...s.rangeConfigs, { from, to, config }] })),

  removeRangeConfig: (index) =>
    set(s => ({ rangeConfigs: s.rangeConfigs.filter((_, i) => i !== index) })),

  setPageConfig: (pageNum, config) =>
    set(s => ({ pageConfigs: { ...s.pageConfigs, [pageNum]: config } })),

  applyConfigToAll: (config) => {
    set({ globalConfig: config, oddEvenConfig: {}, rangeConfigs: [], pageConfigs: {} })
    persistFromState(get())
  },

  resetConfig: () => {
    const baseSnapshot: ConfigSnapshot = {
      globalConfig: { ...DEFAULT_CONFIG },
      oddEvenConfig: {},
      rangeConfigs: [],
      pageConfigs: {},
    }
    set({
      mode: 'uniform' as const,
      globalConfig: { ...DEFAULT_CONFIG },
      oddEvenConfig: {},
      rangeConfigs: [],
      pageConfigs: {},
      history: [baseSnapshot],
      historyIndex: 0,
    })
    persistFromState(get())
  },

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
