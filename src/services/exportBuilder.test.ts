import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock jszip
const mockFile = vi.fn()
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip']))
vi.mock('jszip', () => ({
  default: vi.fn(function () {
    return { file: mockFile, generateAsync: mockGenerateAsync }
  }),
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
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'a') return mockAnchor as unknown as HTMLElement
  return document.createElement(tag)
})
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
