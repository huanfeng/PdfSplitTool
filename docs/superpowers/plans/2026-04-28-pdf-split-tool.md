# PDF 分割工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建纯前端 PDF 分割工具，支持可视化拖拽分割线、分级批量配置、导出为单 PDF 或 ZIP。

**Architecture:** React 18 + Vite + TypeScript SPA，无服务器。PDF.js 渲染预览，pdf-lib 通过 CropBox 元数据操作实现分割（保留矢量质量），SVG 叠加在 Canvas 上实现分割线拖拽交互。Zustand 管理 4 层分级覆盖配置树（全局→奇偶→范围→逐页）。

**Tech Stack:** React 18 · Vite 5 · TypeScript 5 · pdfjs-dist ^4 · pdf-lib ^1.17 · zustand ^4 · jszip ^3 · vitest · @testing-library/react

---

## File Map

| 文件 | 职责 |
|------|------|
| `src/types/index.ts` | 所有 TypeScript 接口和类型 |
| `src/store/usePDFStore.ts` | Zustand store，全局状态和 actions |
| `src/services/splitConfigResolver.ts` | 纯函数：给定页码解析最终生效配置 |
| `src/services/pdfRenderer.ts` | 封装 pdfjs-dist，渲染页面到 canvas |
| `src/services/pdfSplitter.ts` | 用 pdf-lib CropBox 生成分割后的 PDF bytes |
| `src/services/exportBuilder.ts` | 组装单文件 PDF 或 ZIP 下载 |
| `src/components/Header.tsx` | 顶部栏：文件上传、页码导航、撤销/重做 |
| `src/components/PageList.tsx` | 左侧缩略图列表，显示分割线位置 |
| `src/components/SplitCanvas.tsx` | 主预览区：canvas + SVG 分割线拖拽 |
| `src/components/ConfigPanel.tsx` | 右侧控制面板：批量模式、比例输入、导出 |
| `src/App.tsx` | 根组件，CSS Grid 布局 |
| `src/App.css` | 全局样式和布局 |
| `src/main.tsx` | 入口，配置 pdfjs worker |
| `vite.config.ts` | Vite 配置，含 vitest 配置 |

---

## Task 1: Project Bootstrap & Git Init

**Files:**
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `.gitignore`

- [ ] **Step 1: 初始化 git 仓库**

```bash
cd D:/Develop/workspace/web_develop/pdf_split_tool
git init
```

Expected: `Initialized empty Git repository in .../pdf_split_tool/.git/`

- [ ] **Step 2: 用 Vite 脚手架创建项目（在当前目录）**

```bash
pnpm create vite . --template react-ts
```

当提示 "Current directory is not empty. Remove existing files and continue?" 选 `Ignore files and continue`。

- [ ] **Step 3: 安装所有依赖**

```bash
pnpm install
pnpm add pdfjs-dist pdf-lib zustand jszip
pnpm add -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 4: 更新 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 5: 创建测试 setup 文件**

创建 `src/test/setup.ts`：
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: 更新 src/main.tsx，配置 pdfjs worker**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import * as pdfjsLib from 'pdfjs-dist'
import App from './App.tsx'
import './App.css'

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 7: 删除 Vite 默认样板文件**

```bash
rm -f src/assets/react.svg public/vite.svg src/index.css
```

- [ ] **Step 8: 验证项目能启动**

```bash
pnpm dev
```

Expected: 浏览器打开 http://localhost:5173，显示 React 页面（可能报错因为 App.tsx 还未修改，但 Vite 服务器应该正常运行）。`Ctrl+C` 停止。

- [ ] **Step 9: 提交初始化代码**

```bash
git add -A
git commit -m "feat: bootstrap React+Vite+TypeScript project with pdfjs-dist and pdf-lib"
```

---

## Task 2: Core Types & Zustand Store

**Files:**
- Create: `src/types/index.ts`
- Create: `src/store/usePDFStore.ts`
- Create: `src/store/usePDFStore.test.ts`

- [ ] **Step 1: 创建 src/types/index.ts**

```typescript
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
```

- [ ] **Step 2: 创建 src/store/usePDFStore.ts**

```typescript
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
    pageConfigs: { ...state.pageConfigs },
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

  globalConfig: { ...DEFAULT_CONFIG },
  oddEvenConfig: {},
  rangeConfigs: [],
  pageConfigs: {},

  thumbnailCache: {},
  history: [],
  historyIndex: -1,

  loadPDF: async (file: File) => {
    const buffer = await file.arrayBuffer()
    const pdfDoc = await loadPDFDocument(buffer)
    set({
      pdfDoc,
      pdfBytes: buffer,
      fileName: file.name,
      pageCount: pdfDoc.numPages,
      currentPage: 1,
      globalConfig: { ...DEFAULT_CONFIG },
      oddEvenConfig: {},
      rangeConfigs: [],
      pageConfigs: {},
      thumbnailCache: {},
      history: [],
      historyIndex: -1,
    })
  },

  setCurrentPage: (page) => set({ currentPage: page }),

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
    if (newHistory.length > MAX_HISTORY) newHistory.shift()
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
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
      globalConfig: { ...DEFAULT_CONFIG }, oddEvenConfig: {}, rangeConfigs: [],
      pageConfigs: {}, thumbnailCache: {}, history: [], historyIndex: -1,
    }),
}))
```

- [ ] **Step 3: 创建 src/store/usePDFStore.test.ts 并运行（此时会因缺少 pdfRenderer 而失败，先跳过 loadPDF，测试其余 actions）**

创建 `src/store/usePDFStore.test.ts`：
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { usePDFStore } from './usePDFStore'

describe('usePDFStore', () => {
  beforeEach(() => {
    usePDFStore.getState().reset()
  })

  it('初始状态：全局配置为 50% 垂直分割', () => {
    const { globalConfig } = usePDFStore.getState()
    expect(globalConfig).toEqual({ ratio: 0.5, direction: 'vertical' })
  })

  it('setGlobalConfig 更新全局配置', () => {
    usePDFStore.getState().setGlobalConfig({ ratio: 0.4, direction: 'horizontal' })
    expect(usePDFStore.getState().globalConfig).toEqual({ ratio: 0.4, direction: 'horizontal' })
  })

  it('setPageConfig 设置单页配置', () => {
    usePDFStore.getState().setPageConfig(3, { ratio: 0.6, direction: 'vertical' })
    expect(usePDFStore.getState().pageConfigs[3]).toEqual({ ratio: 0.6, direction: 'vertical' })
  })

  it('applyConfigToAll 清除所有覆盖配置', () => {
    usePDFStore.getState().setPageConfig(1, { ratio: 0.7, direction: 'vertical' })
    usePDFStore.getState().addRangeConfig(1, 5, { ratio: 0.45, direction: 'vertical' })
    usePDFStore.getState().applyConfigToAll({ ratio: 0.5, direction: 'vertical' })
    const state = usePDFStore.getState()
    expect(Object.keys(state.pageConfigs)).toHaveLength(0)
    expect(state.rangeConfigs).toHaveLength(0)
    expect(state.globalConfig.ratio).toBe(0.5)
  })

  it('pushHistory + undo + redo 撤销重做', () => {
    const store = usePDFStore.getState()
    store.setGlobalConfig({ ratio: 0.5, direction: 'vertical' })
    store.pushHistory()
    store.setGlobalConfig({ ratio: 0.6, direction: 'vertical' })
    store.pushHistory()
    usePDFStore.getState().undo()
    expect(usePDFStore.getState().globalConfig.ratio).toBe(0.5)
    usePDFStore.getState().redo()
    expect(usePDFStore.getState().globalConfig.ratio).toBe(0.6)
  })

  it('setOddConfig / setEvenConfig 分别设置奇偶页', () => {
    usePDFStore.getState().setOddConfig({ ratio: 0.45, direction: 'vertical' })
    usePDFStore.getState().setEvenConfig({ ratio: 0.55, direction: 'vertical' })
    const { oddEvenConfig } = usePDFStore.getState()
    expect(oddEvenConfig.odd?.ratio).toBe(0.45)
    expect(oddEvenConfig.even?.ratio).toBe(0.55)
  })
})
```

- [ ] **Step 4: 运行测试，应通过（除 loadPDF 相关的以外）**

先创建一个空的 `src/services/pdfRenderer.ts` 以避免导入错误：
```typescript
// src/services/pdfRenderer.ts - 占位，Task 4 会实现
import type { PDFDocumentProxy } from 'pdfjs-dist'
export async function loadPDFDocument(_buffer: ArrayBuffer): Promise<PDFDocumentProxy> {
  throw new Error('Not implemented yet')
}
```

运行：
```bash
pnpm vitest run src/store/usePDFStore.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/types/index.ts src/store/ src/services/pdfRenderer.ts
git commit -m "feat: add core types, Zustand store, and splitConfigResolver stub"
```

---

## Task 3: splitConfigResolver Service (TDD)

**Files:**
- Create: `src/services/splitConfigResolver.ts`
- Create: `src/services/splitConfigResolver.test.ts`

- [ ] **Step 1: 写失败测试 src/services/splitConfigResolver.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { resolveConfig } from './splitConfigResolver'
import type { SplitConfig, ConfigSnapshot } from '../types'

const V: SplitConfig = { ratio: 0.5, direction: 'vertical' }
const snap = (overrides: Partial<ConfigSnapshot> = {}): ConfigSnapshot => ({
  globalConfig: V,
  oddEvenConfig: {},
  rangeConfigs: [],
  pageConfigs: {},
  ...overrides,
})

describe('resolveConfig', () => {
  it('无任何覆盖时返回全局配置', () => {
    expect(resolveConfig(1, snap())).toEqual(V)
  })

  it('奇数页有奇页覆盖时使用奇页配置', () => {
    const oddCfg: SplitConfig = { ratio: 0.45, direction: 'vertical' }
    expect(resolveConfig(1, snap({ oddEvenConfig: { odd: oddCfg } }))).toEqual(oddCfg)
  })

  it('偶数页有偶页覆盖时使用偶页配置', () => {
    const evenCfg: SplitConfig = { ratio: 0.55, direction: 'vertical' }
    expect(resolveConfig(2, snap({ oddEvenConfig: { even: evenCfg } }))).toEqual(evenCfg)
  })

  it('奇数页不使用偶页配置', () => {
    const evenCfg: SplitConfig = { ratio: 0.55, direction: 'vertical' }
    expect(resolveConfig(3, snap({ oddEvenConfig: { even: evenCfg } }))).toEqual(V)
  })

  it('页范围覆盖奇偶配置', () => {
    const oddCfg: SplitConfig = { ratio: 0.45, direction: 'vertical' }
    const rangeCfg: SplitConfig = { ratio: 0.6, direction: 'vertical' }
    const s = snap({
      oddEvenConfig: { odd: oddCfg },
      rangeConfigs: [{ from: 1, to: 5, config: rangeCfg }],
    })
    expect(resolveConfig(1, s)).toEqual(rangeCfg)
  })

  it('逐页配置覆盖所有其他配置', () => {
    const pageCfg: SplitConfig = { ratio: 0.7, direction: 'horizontal' }
    const s = snap({
      oddEvenConfig: { odd: { ratio: 0.45, direction: 'vertical' } },
      rangeConfigs: [{ from: 1, to: 10, config: { ratio: 0.6, direction: 'vertical' } }],
      pageConfigs: { 1: pageCfg },
    })
    expect(resolveConfig(1, s)).toEqual(pageCfg)
  })

  it('页范围取最后匹配项（多个范围重叠时）', () => {
    const cfg1: SplitConfig = { ratio: 0.4, direction: 'vertical' }
    const cfg2: SplitConfig = { ratio: 0.6, direction: 'vertical' }
    const s = snap({
      rangeConfigs: [
        { from: 1, to: 10, config: cfg1 },
        { from: 3, to: 8, config: cfg2 },
      ],
    })
    expect(resolveConfig(5, s)).toEqual(cfg2)
    expect(resolveConfig(2, s)).toEqual(cfg1)
  })

  it('不在范围内的页使用全局配置', () => {
    const s = snap({ rangeConfigs: [{ from: 3, to: 5, config: { ratio: 0.6, direction: 'vertical' } }] })
    expect(resolveConfig(1, s)).toEqual(V)
    expect(resolveConfig(6, s)).toEqual(V)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
pnpm vitest run src/services/splitConfigResolver.test.ts
```

Expected: FAIL — "Cannot find module './splitConfigResolver'"

- [ ] **Step 3: 实现 src/services/splitConfigResolver.ts**

```typescript
import type { SplitConfig, ConfigSnapshot } from '../types'

export function resolveConfig(pageNum: number, snapshot: ConfigSnapshot): SplitConfig {
  let cfg: SplitConfig = snapshot.globalConfig

  const isOdd = pageNum % 2 === 1
  const oe = isOdd ? snapshot.oddEvenConfig.odd : snapshot.oddEvenConfig.even
  if (oe) cfg = oe

  const matchedRange = snapshot.rangeConfigs.findLast(
    r => pageNum >= r.from && pageNum <= r.to
  )
  if (matchedRange) cfg = matchedRange.config

  const perPage = snapshot.pageConfigs[pageNum]
  if (perPage) cfg = perPage

  return cfg
}
```

- [ ] **Step 4: 运行测试，验证通过**

```bash
pnpm vitest run src/services/splitConfigResolver.test.ts
```

Expected: 8 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/splitConfigResolver.ts src/services/splitConfigResolver.test.ts
git commit -m "feat: implement splitConfigResolver with cascading priority (TDD)"
```

---

## Task 4: pdfRenderer Service

**Files:**
- Modify: `src/services/pdfRenderer.ts`
- Create: `src/services/pdfRenderer.test.ts`

- [ ] **Step 1: 实现 src/services/pdfRenderer.ts**

```typescript
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export async function loadPDFDocument(buffer: ArrayBuffer): Promise<PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer })
  return loadingTask.promise
}

export async function renderPageToCanvas(
  pdfDoc: PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  containerWidth: number
): Promise<void> {
  const page = await pdfDoc.getPage(pageNum)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = containerWidth / baseViewport.width
  const viewport = page.getViewport({ scale })
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2d context')
  await page.render({ canvasContext: ctx, viewport }).promise
}

export async function renderThumbnail(
  pdfDoc: PDFDocumentProxy,
  pageNum: number,
  maxWidth = 90
): Promise<ImageBitmap> {
  const page = await pdfDoc.getPage(pageNum)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = maxWidth / baseViewport.width
  const viewport = page.getViewport({ scale })
  const offscreen = new OffscreenCanvas(
    Math.floor(viewport.width),
    Math.floor(viewport.height)
  )
  const ctx = offscreen.getContext('2d') as CanvasRenderingContext2D
  await page.render({ canvasContext: ctx, viewport }).promise
  return createImageBitmap(offscreen)
}

export function getPageDimensions(
  pdfDoc: PDFDocumentProxy,
  pageNum: number
): Promise<{ width: number; height: number }> {
  return pdfDoc.getPage(pageNum).then(page => {
    const vp = page.getViewport({ scale: 1 })
    return { width: vp.width, height: vp.height }
  })
}
```

- [ ] **Step 2: 创建 src/services/pdfRenderer.test.ts（mock pdfjs-dist）**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// pdfjs-dist 依赖浏览器 Worker，在 jsdom 中 mock 整个模块
vi.mock('pdfjs-dist', () => {
  const mockRender = vi.fn().mockReturnValue({ promise: Promise.resolve() })
  const mockGetViewport = vi.fn().mockImplementation(({ scale }: { scale: number }) => ({
    width: 800 * scale,
    height: 600 * scale,
  }))
  const mockPage = { getViewport: mockGetViewport, render: mockRender }
  const mockDoc = {
    numPages: 3,
    getPage: vi.fn().mockResolvedValue(mockPage),
  }
  return {
    getDocument: vi.fn().mockReturnValue({ promise: Promise.resolve(mockDoc) }),
    GlobalWorkerOptions: { workerSrc: '' },
  }
})

import { loadPDFDocument, renderPageToCanvas, getPageDimensions } from './pdfRenderer'
import * as pdfjsLib from 'pdfjs-dist'

describe('pdfRenderer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loadPDFDocument 调用 pdfjs getDocument 并返回 doc', async () => {
    const buffer = new ArrayBuffer(8)
    const doc = await loadPDFDocument(buffer)
    expect(pdfjsLib.getDocument).toHaveBeenCalledWith({ data: buffer })
    expect(doc.numPages).toBe(3)
  })

  it('renderPageToCanvas 根据容器宽度计算 scale', async () => {
    const buffer = new ArrayBuffer(8)
    const doc = await loadPDFDocument(buffer)
    const canvas = document.createElement('canvas')
    await renderPageToCanvas(doc, 1, canvas, 400)
    // scale = 400 / 800 = 0.5，viewport.width = 400, height = 300
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(300)
  })

  it('getPageDimensions 返回页面原始尺寸', async () => {
    const buffer = new ArrayBuffer(8)
    const doc = await loadPDFDocument(buffer)
    const dims = await getPageDimensions(doc, 1)
    expect(dims).toEqual({ width: 800, height: 600 })
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
pnpm vitest run src/services/pdfRenderer.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 4: 提交**

```bash
git add src/services/pdfRenderer.ts src/services/pdfRenderer.test.ts
git commit -m "feat: implement pdfRenderer service wrapping pdfjs-dist"
```

---

## Task 5: pdfSplitter Service (TDD)

**Files:**
- Create: `src/services/pdfSplitter.ts`
- Create: `src/services/pdfSplitter.test.ts`

- [ ] **Step 1: 写失败测试 src/services/pdfSplitter.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SplitConfig, ConfigSnapshot } from '../types'

// mock pdf-lib
const mockSetCropBox = vi.fn()
const mockGetMediaBox = vi.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 })
const mockCopyPages = vi.fn()
const mockAddPage = vi.fn()
const mockSave = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
const mockCreate = vi.fn()

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({
      getPageCount: () => 2,
      getPageIndices: () => [0, 1],
    }),
    create: vi.fn().mockResolvedValue({
      copyPages: mockCopyPages,
      addPage: mockAddPage,
      save: mockSave,
    }),
  },
}))

// 两次 copyPages 调用返回两个带 mock 方法的页面对象
mockCopyPages.mockImplementation((_src: unknown, indices: number[]) =>
  Promise.resolve(
    indices.map(() => ({ getMediaBox: mockGetMediaBox, setCropBox: mockSetCropBox }))
  )
)

import { splitPDF } from './pdfSplitter'

const baseSnap = (overrides: Partial<ConfigSnapshot> = {}): ConfigSnapshot => ({
  globalConfig: { ratio: 0.5, direction: 'vertical' },
  oddEvenConfig: {},
  rangeConfigs: [],
  pageConfigs: {},
  ...overrides,
})

describe('splitPDF', () => {
  beforeEach(() => vi.clearAllMocks())

  it('每页生成两个 CropBox，共调用 2*pageCount 次 setCropBox', async () => {
    const bytes = new ArrayBuffer(8)
    await splitPDF(bytes, 2, baseSnap())
    expect(mockSetCropBox).toHaveBeenCalledTimes(4) // 2页 × 2次
  })

  it('垂直分割时左页 width = ratio*pageWidth', async () => {
    const bytes = new ArrayBuffer(8)
    await splitPDF(bytes, 1, baseSnap())
    // 第一次调用：左页 setCropBox(0, 0, 400, 600)
    expect(mockSetCropBox).toHaveBeenNthCalledWith(1, 0, 0, 400, 600)
    // 第二次调用：右页 setCropBox(400, 0, 400, 600)
    expect(mockSetCropBox).toHaveBeenNthCalledWith(2, 400, 0, 400, 600)
  })

  it('水平分割时上页从 height*(1-ratio) 开始', async () => {
    const snap = baseSnap({ globalConfig: { ratio: 0.5, direction: 'horizontal' } })
    const bytes = new ArrayBuffer(8)
    await splitPDF(bytes, 1, snap)
    // 上半页: setCropBox(0, 300, 800, 300)
    expect(mockSetCropBox).toHaveBeenNthCalledWith(1, 0, 300, 800, 300)
    // 下半页: setCropBox(0, 0, 800, 300)
    expect(mockSetCropBox).toHaveBeenNthCalledWith(2, 0, 0, 800, 300)
  })

  it('返回 Uint8Array', async () => {
    const result = await splitPDF(new ArrayBuffer(8), 1, baseSnap())
    expect(result).toBeInstanceOf(Uint8Array)
  })
})

import { splitPDFToPages } from './pdfSplitter'

describe('splitPDFToPages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('返回长度等于 pageCount 的数组', async () => {
    const results = await splitPDFToPages(new ArrayBuffer(8), 3, baseSnap())
    expect(results).toHaveLength(3)
  })

  it('每个元素都是 Uint8Array', async () => {
    const results = await splitPDFToPages(new ArrayBuffer(8), 2, baseSnap())
    for (const r of results) expect(r).toBeInstanceOf(Uint8Array)
  })

  it('每页独立调用 PDFDocument.create 和 save', async () => {
    await splitPDFToPages(new ArrayBuffer(8), 2, baseSnap())
    expect(mockSave).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

```bash
pnpm vitest run src/services/pdfSplitter.test.ts
```

Expected: FAIL — "Cannot find module './pdfSplitter'"

- [ ] **Step 3: 实现 src/services/pdfSplitter.ts**

```typescript
import { PDFDocument } from 'pdf-lib'
import type { ConfigSnapshot } from '../types'
import { resolveConfig } from './splitConfigResolver'

function applyCropBox(
  pageA: ReturnType<PDFDocument['getPage']>,
  pageB: ReturnType<PDFDocument['getPage']>,
  mediaBox: { x: number; y: number; width: number; height: number },
  ratio: number,
  direction: 'vertical' | 'horizontal'
) {
  const { x, y, width, height } = mediaBox
  if (direction === 'vertical') {
    const splitX = width * ratio
    pageA.setCropBox(x, y, splitX, height)
    pageB.setCropBox(x + splitX, y, width - splitX, height)
  } else {
    const splitY = height * (1 - ratio)
    pageA.setCropBox(x, y + splitY, width, height - splitY)  // 上半
    pageB.setCropBox(x, y, width, splitY)                    // 下半
  }
}

// 将整个文档分割为一个合并 PDF（交叉顺序：1A,1B,2A,2B,...）
export async function splitPDF(
  pdfBytes: ArrayBuffer,
  pageCount: number,
  snapshot: ConfigSnapshot
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const dstDoc = await PDFDocument.create()

  for (let i = 0; i < pageCount; i++) {
    const config = resolveConfig(i + 1, snapshot)
    const [pageA, pageB] = await dstDoc.copyPages(srcDoc, [i, i])
    applyCropBox(pageA, pageB, pageA.getMediaBox(), config.ratio, config.direction)
    dstDoc.addPage(pageA)
    dstDoc.addPage(pageB)
  }

  return dstDoc.save()
}

// 将每页独立分割，返回每页 2 个子页的 PDF bytes 数组（用于 ZIP 导出）
export async function splitPDFToPages(
  pdfBytes: ArrayBuffer,
  pageCount: number,
  snapshot: ConfigSnapshot
): Promise<Uint8Array[]> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const results: Uint8Array[] = []

  for (let i = 0; i < pageCount; i++) {
    const config = resolveConfig(i + 1, snapshot)
    const pageDoc = await PDFDocument.create()
    const [pageA, pageB] = await pageDoc.copyPages(srcDoc, [i, i])
    applyCropBox(pageA, pageB, pageA.getMediaBox(), config.ratio, config.direction)
    pageDoc.addPage(pageA)
    pageDoc.addPage(pageB)
    results.push(await pageDoc.save())
  }

  return results
}
```

- [ ] **Step 4: 运行测试，验证通过**

```bash
pnpm vitest run src/services/pdfSplitter.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/pdfSplitter.ts src/services/pdfSplitter.test.ts
git commit -m "feat: implement pdfSplitter using pdf-lib CropBox (TDD)"
```

---

## Task 6: exportBuilder Service

**Files:**
- Create: `src/services/exportBuilder.ts`
- Create: `src/services/exportBuilder.test.ts`

- [ ] **Step 1: 写测试 src/services/exportBuilder.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock jszip
const mockFile = vi.fn()
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip']))
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({ file: mockFile, generateAsync: mockGenerateAsync })),
}))

// mock URL.createObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
const mockRevokeObjectURL = vi.fn()
Object.assign(globalThis, {
  URL: { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL },
})

// mock document.createElement('a') click
const mockClick = vi.fn()
const mockAnchor = { href: '', download: '', click: mockClick, remove: vi.fn() }
vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement)
vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as Node)

import { downloadSinglePDF, downloadZIP } from './exportBuilder'

describe('exportBuilder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('downloadSinglePDF 触发 <a> 下载', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    await downloadSinglePDF(bytes, 'test.pdf')
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(mockAnchor.download).toBe('test.pdf')
  })

  it('downloadZIP 为每个 PDF 调用 jszip.file', async () => {
    const pages = [
      { filename: 'page-01.pdf', bytes: new Uint8Array([1]) },
      { filename: 'page-02.pdf', bytes: new Uint8Array([2]) },
    ]
    await downloadZIP(pages, 'output.zip')
    expect(mockFile).toHaveBeenCalledTimes(2)
    expect(mockFile).toHaveBeenCalledWith('page-01.pdf', expect.any(Uint8Array))
    expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' })
    expect(mockClick).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 实现 src/services/exportBuilder.ts**

```typescript
import JSZip from 'jszip'

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadSinglePDF(bytes: Uint8Array, filename: string): Promise<void> {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
}

export interface PageExport {
  filename: string
  bytes: Uint8Array
}

export async function downloadZIP(pages: PageExport[], zipFilename: string): Promise<void> {
  const zip = new JSZip()
  for (const { filename, bytes } of pages) {
    zip.file(filename, bytes)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, zipFilename)
}
```

- [ ] **Step 3: 运行测试**

```bash
pnpm vitest run src/services/exportBuilder.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 4: 提交**

```bash
git add src/services/exportBuilder.ts src/services/exportBuilder.test.ts
git commit -m "feat: implement exportBuilder for single PDF and ZIP download"
```

---

## Task 7: App Layout + Header Component

**Files:**
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/components/Header.tsx`
- Create: `src/components/Header.module.css`

- [ ] **Step 1: 创建 src/App.css（全局样式 + CSS Grid 布局）**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-deep:    #0d1117;
  --bg-base:    #161b22;
  --bg-raised:  #1c2128;
  --bg-card:    #21262d;
  --border:     #30363d;
  --text:       #e6edf3;
  --text-muted: #8b949e;
  --accent:     #58a6ff;
  --danger:     #e94560;
  --success:    #3fb950;
  --warning:    #e3b341;
  --header-h:   48px;
  --pagelist-w: 120px;
  --config-w:   200px;
}

html, body, #root { height: 100%; }
body { background: var(--bg-deep); color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; }

.app-layout {
  display: grid;
  grid-template-rows: var(--header-h) 1fr;
  grid-template-columns: var(--pagelist-w) 1fr var(--config-w);
  grid-template-areas:
    "header header header"
    "pagelist canvas config";
  height: 100vh;
  overflow: hidden;
}

button {
  cursor: pointer;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-raised);
  color: var(--text);
  padding: 4px 10px;
  font-size: 12px;
  transition: background 0.15s;
}
button:hover { background: var(--bg-card); }
button:disabled { opacity: 0.4; cursor: not-allowed; }

input[type="number"], input[type="text"] {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 3px 8px;
  font-size: 13px;
  width: 100%;
}
input:focus { outline: 1px solid var(--accent); }

.btn-primary {
  background: var(--success);
  border-color: var(--success);
  color: #fff;
  font-weight: 600;
}
.btn-primary:hover { background: #2ea043; }

.btn-danger {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}
```

- [ ] **Step 2: 创建 src/components/Header.tsx**

```tsx
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
```

- [ ] **Step 3: 创建 src/components/Header.module.css**

```css
.dropzone {
  grid-area: header;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--border);
  border-radius: 8px;
  margin: 16px;
  cursor: pointer;
  transition: border-color 0.2s;
  height: calc(100vh - 32px);
}
.dropzone:hover { border-color: var(--accent); }
.dropzoneInner { text-align: center; color: var(--text-muted); }
.icon { font-size: 48px; display: block; margin-bottom: 12px; }
.hint { font-size: 12px; margin-top: 4px; }

.header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: var(--bg-base);
  border-bottom: 1px solid var(--border);
}
.filename { font-weight: 600; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.pageInfo { display: flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: 13px; }
.pageInput { width: 48px; text-align: center; }
.actions { display: flex; gap: 6px; }
```

- [ ] **Step 4: 创建 src/App.tsx（骨架布局，PageList/SplitCanvas/ConfigPanel 先用占位 div）**

```tsx
import { useEffect } from 'react'
import { usePDFStore } from './store/usePDFStore'
import { Header } from './components/Header'

function App() {
  const { fileName, undo, redo } = usePDFStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  if (!fileName) {
    return (
      <div style={{ height: '100vh', background: 'var(--bg-deep)' }}>
        <Header />
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Header />
      <div style={{ gridArea: 'pagelist', background: 'var(--bg-base)', borderRight: '1px solid var(--border)' }}>
        {/* Task 8: PageList */}
      </div>
      <div style={{ gridArea: 'canvas', background: 'var(--bg-deep)' }}>
        {/* Task 9: SplitCanvas */}
      </div>
      <div style={{ gridArea: 'config', background: 'var(--bg-base)', borderLeft: '1px solid var(--border)' }}>
        {/* Task 10: ConfigPanel */}
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 5: 启动开发服务器验证布局**

```bash
pnpm dev
```

打开 http://localhost:5173，应看到：
- 未上传文件时：全屏拖放区域（虚线边框）
- 上传一个 PDF 后：顶部 Header 显示文件名和页码导航，下方三列骨架

`Ctrl+C` 停止。

- [ ] **Step 6: 提交**

```bash
git add src/App.tsx src/App.css src/components/Header.tsx src/components/Header.module.css
git commit -m "feat: add App layout (CSS Grid) and Header component with file drop"
```

---

## Task 8: PageList Component

**Files:**
- Create: `src/components/PageList.tsx`
- Create: `src/components/PageList.module.css`

- [ ] **Step 1: 创建 src/components/PageList.tsx**

```tsx
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
```

- [ ] **Step 2: 创建 src/components/PageList.module.css**

```css
.list {
  grid-area: pagelist;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  overflow-y: auto;
  background: var(--bg-base);
  border-right: 1px solid var(--border);
}

.item {
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  transition: border-color 0.15s;
}
.item:hover { border-color: var(--border); }
.active { border-color: var(--accent) !important; background: var(--bg-raised); }

.thumb { width: 100%; background: var(--bg-card); border-radius: 2px; overflow: hidden; }
.placeholder { height: 60px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 11px; }
.pageNum { font-size: 10px; color: var(--text-muted); }
```

- [ ] **Step 3: 在 App.tsx 中替换 PageList 占位符**

将 `src/App.tsx` 中的：
```tsx
      <div style={{ gridArea: 'pagelist', background: 'var(--bg-base)', borderRight: '1px solid var(--border)' }}>
        {/* Task 8: PageList */}
      </div>
```

替换为：
```tsx
      <PageList />
```

并在文件顶部添加导入：
```tsx
import { PageList } from './components/PageList'
```

- [ ] **Step 4: 验证缩略图功能**

```bash
pnpm dev
```

上传一个 PDF，左侧应出现页面缩略图列表，每张缩略图上有红色分割线，点击跳转页码。`Ctrl+C` 停止。

- [ ] **Step 5: 提交**

```bash
git add src/components/PageList.tsx src/components/PageList.module.css src/App.tsx
git commit -m "feat: add PageList component with thumbnails and split line overlay"
```

---

## Task 9: SplitCanvas Component

**Files:**
- Create: `src/components/SplitCanvas.tsx`
- Create: `src/components/SplitCanvas.module.css`

- [ ] **Step 1: 创建 src/components/SplitCanvas.tsx**

```tsx
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
    renderPageToCanvas(pdfDoc, currentPage, canvasRef.current, containerW).then(() => {
      setCanvasSize({ w: canvasRef.current!.width, h: canvasRef.current!.height })
    })
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
```

- [ ] **Step 2: 创建 src/components/SplitCanvas.module.css**

```css
.container {
  grid-area: canvas;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: var(--bg-deep);
  padding: 16px;
}

.wrapper {
  position: relative;
  display: inline-block;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
}

.canvas {
  display: block;
  max-width: 100%;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.overlay circle {
  pointer-events: all;
}
```

- [ ] **Step 3: 在 App.tsx 中替换 SplitCanvas 占位符**

将：
```tsx
      <div style={{ gridArea: 'canvas', background: 'var(--bg-deep)' }}>
        {/* Task 9: SplitCanvas */}
      </div>
```

替换为：
```tsx
      <SplitCanvas />
```

并添加导入：
```tsx
import { SplitCanvas } from './components/SplitCanvas'
```

- [ ] **Step 4: 验证拖拽交互**

```bash
pnpm dev
```

上传 PDF，主预览区应显示 PDF 页面，红色分割线可以拖拽，两侧显示百分比，键盘方向键微调（Shift+方向键大步调整）。`Ctrl+C` 停止。

- [ ] **Step 5: 提交**

```bash
git add src/components/SplitCanvas.tsx src/components/SplitCanvas.module.css src/App.tsx
git commit -m "feat: add SplitCanvas with canvas+SVG overlay drag interaction and keyboard fine-tune"
```

---

## Task 10: ConfigPanel Component

**Files:**
- Create: `src/components/ConfigPanel.tsx`
- Create: `src/components/ConfigPanel.module.css`

- [ ] **Step 1: 创建 src/components/ConfigPanel.tsx**

```tsx
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
    setGlobalConfig, setOddConfig, setEvenConfig,
    addRangeConfig, setPageConfig, applyConfigToAll, pushHistory,
  } = store

  const snapshot = { globalConfig, oddEvenConfig, rangeConfigs, pageConfigs }
  const config = resolveConfig(currentPage, snapshot)

  const [mode, setMode] = useState<'uniform' | 'oddeven' | 'range' | 'page'>('uniform')
  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(pageCount || 1)
  const [exporting, setExporting] = useState(false)

  const updateRatio = (ratio: number) => {
    const clamped = Math.max(0.05, Math.min(0.95, ratio))
    const newConfig: SplitConfig = { ...config, ratio: clamped }
    if (mode === 'uniform') applyConfigToAll(newConfig)
    else if (mode === 'oddeven') {
      if (currentPage % 2 === 1) setOddConfig(newConfig)
      else setEvenConfig(newConfig)
    } else if (mode === 'range') addRangeConfig(rangeFrom, rangeTo, newConfig)
    else setPageConfig(currentPage, newConfig)
    pushHistory()
  }

  const updateDirection = (direction: SplitConfig['direction']) => {
    const newConfig: SplitConfig = { ...config, direction }
    setPageConfig(currentPage, newConfig)
    pushHistory()
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
```

- [ ] **Step 2: 创建 src/components/ConfigPanel.module.css**

```css
.panel {
  grid-area: config;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  background: var(--bg-base);
  border-left: 1px solid var(--border);
}

.section {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.btnGroup, .modeGroup {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.modeGroup button { flex: 1; min-width: 0; font-size: 11px; padding: 4px 4px; }

.active {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  color: #fff !important;
}

.rangeRow { display: flex; align-items: center; gap: 6px; }
.rangeRow input { width: 60px; }

.ratioRow { display: flex; align-items: center; gap: 6px; }
.ratioInput { width: 70px; font-size: 16px; font-weight: bold; color: var(--accent); }
.pct { color: var(--text-muted); }

.slider { width: 100%; accent-color: var(--accent); }

.exportSection {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}
```

- [ ] **Step 3: 在 App.tsx 中替换 ConfigPanel 占位符**

将：
```tsx
      <div style={{ gridArea: 'config', background: 'var(--bg-base)', borderLeft: '1px solid var(--border)' }}>
        {/* Task 10: ConfigPanel */}
      </div>
```

替换为：
```tsx
      <ConfigPanel />
```

并添加导入：
```tsx
import { ConfigPanel } from './components/ConfigPanel'
```

- [ ] **Step 4: 全流程验证**

```bash
pnpm dev
```

验证完整流程：
1. 拖入 A3 PDF 文件
2. 右侧面板显示分割方向、批量模式、比例滑块
3. 调整比例，主预览区分割线同步移动
4. 切换奇偶页模式，为奇数页设 45%，偶数页设 55%
5. 点击"下载单 PDF"，检查下载的 PDF 文件是否正确分割
6. 点击"下载 ZIP"

`Ctrl+C` 停止。

- [ ] **Step 5: 提交**

```bash
git add src/components/ConfigPanel.tsx src/components/ConfigPanel.module.css src/App.tsx
git commit -m "feat: add ConfigPanel with batch modes, ratio slider, and export buttons"
```

---

## Task 11: Final Polish & Cleanup

**Files:**
- Modify: `src/App.tsx`（键盘快捷键完善）
- Modify: `index.html`（title 和 meta）

- [ ] **Step 1: 更新 index.html 的标题和 meta**

将 `<title>Vite + React + TS</title>` 改为：
```html
<title>PDF 分割工具</title>
<meta name="description" content="纯前端 PDF 分割工具，支持 A3→A4 分割，可视化拖拽预览">
```

- [ ] **Step 2: 运行全部测试，确保通过**

```bash
pnpm vitest run
```

Expected: 所有测试 PASS（包括 splitConfigResolver、pdfRenderer、pdfSplitter、exportBuilder、store 共约 20 个测试）

- [ ] **Step 3: 构建生产包，验证无报错**

```bash
pnpm build
```

Expected: `dist/` 目录生成成功，无 TypeScript 错误，无构建报错。

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: complete PDF split tool — polish, title update, full test suite passes"
```

---

## 自审：Spec 覆盖检查

| 规格需求 | 对应任务 |
|---------|---------|
| 文件拖放上传，纯浏览器端 | Task 7 Header |
| PDF.js 渲染预览 + 缩略图 | Task 4, 8 |
| SVG 分割线拖拽 + 比例显示 | Task 9 SplitCanvas |
| 左右 / 上下两种分割方向 | Task 9, 10 |
| 全局配置（统一比例） | Task 2 store, Task 10 |
| 奇偶页不同比例 | Task 2, 10 |
| 页范围配置 | Task 2, 10 |
| 逐页配置 | Task 2, 10 |
| 分级覆盖解析 | Task 3 splitConfigResolver |
| CropBox 矢量质量输出 | Task 5 pdfSplitter |
| 单 PDF 合并导出 | Task 6, 10 |
| ZIP 多文件导出 | Task 6, 10 |
| 撤销 / 重做（Ctrl+Z/Y） | Task 2 store, Task 7 App |
| 键盘方向键微调比例 | Task 9 SplitCanvas |
| 缩略图分割线叠加 | Task 8 PageList |
| git 阶段性提交 | 每个 Task 末尾 |
