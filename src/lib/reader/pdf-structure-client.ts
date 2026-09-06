/**
 * PDF 结构化解析主线程客户端：单例 Worker + 整档 Markdown 缓存（按文档指纹）。
 * 契约：永不抛错——WASM 不可用 / 超时 / 解析失败一律返回 null/false，
 * 调用方（Agent 正文）静默回退 pdf.js 路径。
 */
import {
  PDF_STRUCTURE_MAX_BYTES,
  PDF_STRUCTURE_TIMEOUT_MS,
  splitMarkdownByPageMarkers,
} from './pdf-structure'
import type { StructureResponse } from './pdf-structure.worker'

export type PdfStructureStatus = 'idle' | 'ready' | 'unavailable'

export interface PdfStructureState {
  status: PdfStructureStatus
  reason: string
}

interface PendingRequest {
  resolve: (response: StructureResponse) => void
  timer: ReturnType<typeof setTimeout>
}

class PdfStructureClient {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private markdownByDoc = new Map<string, string>()
  private status: PdfStructureStatus = 'idle'
  private reason = ''

  getState(): PdfStructureState {
    return { status: this.status, reason: this.reason }
  }

  isUnavailable(): boolean {
    return this.status === 'unavailable'
  }

  hasDocument(docKey: string): boolean {
    return this.markdownByDoc.has(docKey)
  }

  /** 已缓存文档的单页正文；未缓存返回 null（不触发解析，调用方决定是否 parse） */
  getCachedPageText(docKey: string, page: number): string | null {
    const markdown = this.markdownByDoc.get(docKey)
    if (markdown === undefined) return null
    return splitMarkdownByPageMarkers(markdown, page).get(page) ?? null
  }

  /**
   * 解析整档并缓存。bytes 须是可丢弃的拷贝（会被 transfer，接管所有权）。
   * 超限 / 不可用 / 失败返回 false。
   */
  async parseDocument(docKey: string, bytes: ArrayBuffer | Uint8Array): Promise<boolean> {
    if (this.markdownByDoc.has(docKey)) return true
    if (this.status === 'unavailable') return false
    if (bytes.byteLength > PDF_STRUCTURE_MAX_BYTES) {
      this.markUnavailable(`文档 ${bytes.byteLength}B 超过 WASM 解析上限`)
      return false
    }
    const worker = this.ensureWorker()
    if (!worker) return false
    try {
      const response = await this.request(worker, bytes)
      if (!response.ok || typeof response.markdown !== 'string') {
        this.markUnavailable(response.error || 'WASM 解析失败')
        return false
      }
      this.markdownByDoc.set(docKey, response.markdown)
      this.status = 'ready'
      this.reason = ''
      return true
    } catch {
      return false
    }
  }

  /** 文档切换 / 卸载时释放 Worker 与缓存 */
  dispose(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
    }
    this.pending.clear()
    this.markdownByDoc.clear()
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.status = 'idle'
    this.reason = ''
  }

  private ensureWorker(): Worker | null {
    if (typeof window === 'undefined') return null
    if (!this.worker) {
      try {
        const worker = new Worker(new URL('./pdf-structure.worker.ts', import.meta.url), {
          type: 'module',
        })
        worker.onmessage = (event: MessageEvent<StructureResponse>) => {
          const pending = this.pending.get(event.data.id)
          if (!pending) return
          this.pending.delete(event.data.id)
          clearTimeout(pending.timer)
          pending.resolve(event.data)
        }
        worker.onerror = () => {
          this.markUnavailable('Worker 启动失败')
        }
        this.worker = worker
      } catch (cause) {
        this.markUnavailable(cause instanceof Error ? cause.message : String(cause))
        return null
      }
    }
    return this.worker
  }

  private request(worker: Worker, bytes: ArrayBuffer | Uint8Array): Promise<StructureResponse> {
    const id = this.nextId
    this.nextId += 1
    return new Promise<StructureResponse>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve({ id, ok: false, error: `解析超时（>${PDF_STRUCTURE_TIMEOUT_MS}ms）` })
      }, PDF_STRUCTURE_TIMEOUT_MS)
      this.pending.set(id, { resolve, timer })
      // transfer：大文档避免一次全量拷贝（bytes 须是调用方的丢弃拷贝）
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
      worker.postMessage({ id, bytes: view }, [view.buffer])
    })
  }

  private markUnavailable(reason: string): void {
    // 失败的 pending 交给各自超时回执，避免误 resolve 竞态
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.status = 'unavailable'
    this.reason = reason
  }
}

export const pdfStructureClient = new PdfStructureClient()
