import { PDFDocument, PDFPage } from 'pdf-lib'
import type { ConfigSnapshot } from '../types'
import { resolveConfig } from './splitConfigResolver'

function applyCropBox(
  pageA: PDFPage,
  pageB: PDFPage,
  mediaBox: { x: number; y: number; width: number; height: number },
  ratio: number,
  direction: 'vertical' | 'horizontal'
) {
  const clampedRatio = Math.max(0.01, Math.min(0.99, ratio))
  const { x, y, width, height } = mediaBox
  if (direction === 'vertical') {
    const splitX = width * clampedRatio
    pageA.setMediaBox(x, y, splitX, height)
    pageA.setCropBox(x, y, splitX, height)
    pageB.setMediaBox(x + splitX, y, width - splitX, height)
    pageB.setCropBox(x + splitX, y, width - splitX, height)
  } else {
    const splitY = height * (1 - clampedRatio)
    pageA.setMediaBox(x, y + splitY, width, height - splitY)
    pageA.setCropBox(x, y + splitY, width, height - splitY)
    pageB.setMediaBox(x, y, width, splitY)
    pageB.setCropBox(x, y, width, splitY)
  }
}

// 将整个文档分割为一个合并 PDF（交叉顺序：1A,1B,2A,2B,...）
export async function splitPDF(
  pdfBytes: ArrayBuffer,
  pageCount: number,
  snapshot: ConfigSnapshot
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const actualPageCount = srcDoc.getPageCount()
  if (pageCount > actualPageCount) {
    throw new RangeError(
      `pageCount (${pageCount}) exceeds document page count (${actualPageCount})`
    )
  }
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
  const actualPageCount = srcDoc.getPageCount()
  if (pageCount > actualPageCount) {
    throw new RangeError(
      `pageCount (${pageCount}) exceeds document page count (${actualPageCount})`
    )
  }
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
