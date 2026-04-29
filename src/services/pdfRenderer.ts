import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export async function loadPDFDocument(buffer: ArrayBuffer): Promise<PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer })
  return loadingTask.promise
}

export function renderPageToCanvas(
  pdfDoc: PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  containerWidth: number
): { promise: Promise<void>; cancel: () => void } {
  let cancelFn: (() => void) | null = null

  const promise = (async () => {
    const page = await pdfDoc.getPage(pageNum)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = containerWidth / baseViewport.width
    const viewport = page.getViewport({ scale })
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2d context')
    const renderTask = page.render({ canvasContext: ctx, viewport, canvas })
    cancelFn = () => renderTask.cancel()
    await renderTask.promise
  })()

  return {
    promise,
    cancel: () => cancelFn?.(),
  }
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
  const ctx = offscreen.getContext('2d')
  if (!ctx) throw new Error('Failed to get OffscreenCanvas 2d context')
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport, canvas: offscreen as unknown as HTMLCanvasElement }).promise
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
