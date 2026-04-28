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

import { loadPDFDocument, renderPageToCanvas, getPageDimensions, renderThumbnail } from './pdfRenderer'
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
    // jsdom 不支持 canvas.getContext('2d')，mock 它返回一个假 context
    const mockCtx = {} as CanvasRenderingContext2D
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx)
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

  it('renderThumbnail 使用 maxWidth 计算 scale 并返回 ImageBitmap', async () => {
    const mockOffscreenCtx = {}
    const mockOffscreenCanvas = { getContext: vi.fn().mockReturnValue(mockOffscreenCtx) }
    vi.stubGlobal('OffscreenCanvas', vi.fn().mockImplementation(function () { return mockOffscreenCanvas }))
    const mockBitmap = { width: 160, height: 120 }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(mockBitmap))

    const doc = await loadPDFDocument(new ArrayBuffer(8))
    // 页面原始宽 800，maxWidth=160 => scale=0.2, width=Math.floor(800*0.2)=160, height=Math.floor(600*0.2)=120
    const bitmap = await renderThumbnail(doc, 1, 160)
    expect(OffscreenCanvas).toHaveBeenCalledWith(160, 120)
    expect(bitmap).toBe(mockBitmap)
  })
})
