import { isOk, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import type { RosettaInspectContentResult } from '@shared/types/rosetta'
import {
  normalizeContentAuditQuery,
  parseContentAuditLimit,
} from '@shared/agent/content-audit'
import { rosettaApi } from '@/api/rosetta-api'
import { collectActiveDocument } from './collect-turn-context'
import { getReaderContentProvider } from './reader-content-registry'
import { inspectEditorBufferText } from './inspect-editor-buffer'

/**
 * 内容审计快照解析（P0 库取证 + P2.1 编辑器内存，只读）。
 *
 * 指纹绑定：取已注册 provider 的 fileFingerprint，且必须与当前活动文档同文件；
 * Agent 不可自带指纹。有指纹走 book-index IPC（语义一字不动）；
 * 无指纹但活动文档是 markdown 时，检索 provider.getCurrentText() 即编辑器内存
 * （未保存修改可见），source='editor-buffer'；其他（EPUB/无 provider）一律抛错。
 * 由快照层转为工具错误（绝不返回空结果冒充）。
 */
export interface InspectIndexedContentDeps {
  getActivePath?: () => string
  getFingerprint?: () => string
  /** 无指纹时读编辑器内存；非 markdown/未绑定返回 null（调用方报不支持） */
  getBufferText?: () => Promise<string | null>
  callInspect?: (
    fingerprint: string,
    query: string,
    limit: number | undefined,
  ) => Promise<Result<RosettaInspectContentResult, AppError>>
}

function defaultDeps(): Required<InspectIndexedContentDeps> {
  return {
    getActivePath: () => collectActiveDocument()?.path ?? '',
    getFingerprint: () => {
      const provider = getReaderContentProvider()
      if (!provider || provider.filePath !== (collectActiveDocument()?.path ?? '')) return ''
      return provider.fileFingerprint ?? ''
    },
    getBufferText: async () => {
      const provider = getReaderContentProvider()
      const active = collectActiveDocument()
      if (!provider || !active || provider.filePath !== active.path) return null
      // 只认 kind，不猜扩展名：EPUB 绝不进内存取证
      if (active.kind !== 'markdown') return null
      return (await provider.getCurrentText()) ?? ''
    },
    callInspect: (fingerprint, query, limit) =>
      rosettaApi.inspectContent({ fingerprint, query, limit }),
  }
}

function parseLimit(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new Error('展示条数须为 1–10 的整数')
  }
  return raw
}

export async function inspectIndexedContentForAgent(
  rawQuery: unknown,
  rawLimit: unknown,
  deps?: InspectIndexedContentDeps,
): Promise<string> {
  const resolved = { ...defaultDeps(), ...deps }
  const query = typeof rawQuery === 'string' ? rawQuery : ''
  if (!query.trim()) throw new Error('审计需要非空的 query 参数')
  const limit = parseLimit(rawLimit)
  // 范围校验前置（与主进程同文案，指纹路径行为不变；且保证短词不读正文）
  const validQuery = normalizeContentAuditQuery(query)
  if (!validQuery) throw new Error('检索词至少需要 3 个字符')
  const validLimit = parseContentAuditLimit(rawLimit)
  if (!validLimit) throw new Error('展示条数须为 1–10 的整数')
  const activePath = resolved.getActivePath()
  if (!activePath) throw new Error('当前没有打开的文档')
  const fingerprint = resolved.getFingerprint()
  if (fingerprint) {
    const result = await resolved.callInspect(fingerprint, query, limit)
    if (!isOk(result)) throw new Error(result.error.message || '内容审计失败')
    return JSON.stringify(result.value, null, 2)
  }
  // P2.1：无指纹 + markdown 活动文档 → 检索编辑器内存
  const text = await resolved.getBufferText()
  if (text === null) throw new Error('当前文档不支持内容审计（仅已入库 PDF）')
  return JSON.stringify(inspectEditorBufferText(text, validQuery, validLimit), null, 2)
}
