import { isOk, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import type { RosettaInspectContentResult } from '@shared/types/rosetta'
import { rosettaApi } from '@/api/rosetta-api'
import { collectActiveDocument } from './collect-turn-context'
import { getReaderContentProvider } from './reader-content-registry'

/**
 * 已入库内容审计快照解析（P0，只读取证）。
 *
 * 指纹绑定：取已注册 provider 的 fileFingerprint，且必须与当前活动文档同文件；
 * Agent 不可自带指纹。无文档 / 非 PDF provider / 未绑定指纹一律抛错，
 * 由快照层转为工具错误（绝不返回空结果冒充）。
 */
export interface InspectIndexedContentDeps {
  getActivePath?: () => string
  getFingerprint?: () => string
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
  const activePath = resolved.getActivePath()
  if (!activePath) throw new Error('当前没有打开的文档')
  const fingerprint = resolved.getFingerprint()
  if (!fingerprint) throw new Error('当前文档不支持内容审计（仅已入库 PDF）')
  const result = await resolved.callInspect(fingerprint, query, limit)
  if (!isOk(result)) throw new Error(result.error.message || '内容审计失败')
  return JSON.stringify(result.value, null, 2)
}
