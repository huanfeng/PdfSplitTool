import JSZip from 'jszip'

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  if (a.style) a.style.display = 'none'
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    if (a instanceof Element && document.body.contains(a)) document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 1000)
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
