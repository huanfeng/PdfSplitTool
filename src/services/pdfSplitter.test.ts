import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ConfigSnapshot } from '../types'

// mock pdf-lib — 使用 vi.hoisted 确保变量在 hoisting 后可用
const {
  mockSetCropBox,
  mockCopyPages,
  mockAddPage,
  mockSave,
} = vi.hoisted(() => {
  const mockSetCropBox = vi.fn()
  const mockSetMediaBox = vi.fn()
  const mockGetMediaBox = vi.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 })
  const mockAddPage = vi.fn()
  const mockSave = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
  const mockCopyPages = vi.fn().mockImplementation((_src: unknown, indices: number[]) =>
    Promise.resolve(
      indices.map(() => ({ getMediaBox: mockGetMediaBox, setCropBox: mockSetCropBox, setMediaBox: mockSetMediaBox }))
    )
  )
  return { mockSetCropBox, mockSetMediaBox, mockGetMediaBox, mockCopyPages, mockAddPage, mockSave }
})

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({
      getPageCount: () => 10,
      getPageIndices: () => [0, 1],
    }),
    create: vi.fn().mockResolvedValue({
      copyPages: mockCopyPages,
      addPage: mockAddPage,
      save: mockSave,
    }),
  },
}))

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

describe('applyCropBox clamp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ratio=0 时 clamp 后 CropBox 宽度大于 0', async () => {
    const snap = baseSnap({ globalConfig: { ratio: 0, direction: 'vertical' } })
    await splitPDF(new ArrayBuffer(8), 1, snap)
    const calls = mockSetCropBox.mock.calls
    // 左页和右页的 width 参数（第3个参数）都应大于 0
    expect(calls[0][2]).toBeGreaterThan(0)
    expect(calls[1][2]).toBeGreaterThan(0)
  })

  it('ratio=1 时 clamp 后右页起始位置不超出 mediaBox', async () => {
    const snap = baseSnap({ globalConfig: { ratio: 1, direction: 'vertical' } })
    await splitPDF(new ArrayBuffer(8), 1, snap)
    const calls = mockSetCropBox.mock.calls
    // 右页 x（第1个参数）+ width（第3个参数）不超过 mediaBox.width=800
    expect(calls[1][0] + calls[1][2]).toBeLessThanOrEqual(800)
  })
})
