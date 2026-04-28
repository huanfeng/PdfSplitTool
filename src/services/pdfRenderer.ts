import type { PDFDocumentProxy } from 'pdfjs-dist'

export async function loadPDFDocument(_buffer: ArrayBuffer): Promise<PDFDocumentProxy> {
  throw new Error('Not implemented yet')
}
