/**
 * PDF 结构化解析 Worker（pdf-inspector WASM）。
 * 跑在独立线程：WASM parse 是同步 CPU 活，主线程只做收发。
 * 失败一律以 { ok: false } 回执，不抛到主线程；调用方静默回退 pdf.js。
 */
import init, { processPdf } from '@firecrawl/pdf-inspector-wasm'
import wasmUrl from '@firecrawl/pdf-inspector-wasm/pdf_inspector_wasm_bg.wasm?url'

interface StructureRequest {
  id: number
  bytes: ArrayBuffer | Uint8Array
}

export interface StructureResponse {
  id: number
  ok: boolean
  markdown?: string
  pageCount?: number
  /** 1-indexed（processPdf 约定；见 pdf-structure.ts） */
  pagesNeedingOcr?: number[]
  processingTimeMs?: number
  error?: string
}

let ready: Promise<void> | null = null

function ensureInit(): Promise<void> {
  if (!ready) {
    // file:// 下取不到 wasm 时此处 reject，由 client 记 unavailable 并永久回退
    ready = init(wasmUrl).then(() => undefined)
  }
  return ready
}

self.onmessage = async (event: MessageEvent<StructureRequest>): Promise<void> => {
  const { id, bytes } = event.data
  const respond = (partial: Omit<StructureResponse, 'id'>): void => {
    self.postMessage({ id, ...partial } satisfies StructureResponse)
  }
  try {
    await ensureInit()
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    const result = processPdf(input, {
      profile: 'compact',
      includePageMarkers: true,
      includeImages: false,
    })
    respond({
      ok: true,
      markdown: result.markdown ?? '',
      pageCount: result.pageCount,
      pagesNeedingOcr: [...result.pagesNeedingOcr],
      processingTimeMs: result.processingTimeMs,
    })
  } catch (cause) {
    ready = null
    respond({ ok: false, error: cause instanceof Error ? cause.message : String(cause) })
  }
}

export {}
