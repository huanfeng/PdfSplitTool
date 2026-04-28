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
