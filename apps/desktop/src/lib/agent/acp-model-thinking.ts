import type { AcpConfigOption } from '@inkdown/contracts'
import { rankPrimary } from './acp-config-menu'

/**
 * 从模型 currentValue 尾缀提取内嵌思考档（`name[k=v,…]` / `name[档]`）。
 * reasoning_effort/effort/reasoning 取值原文；thinking 按开/关折成 on/off；无等号取裸值。
 */
export function extractModelSuffixThinking(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const m = /\[(.*)\]$/.exec(text)
  if (!m) return null
  const raw = m[1]!.trim()
  if (!raw) return null
  if (!raw.includes('=')) return raw
  for (const part of raw.split(',')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (!k) continue
    if (k === 'reasoning_effort' || k === 'effort' || k === 'reasoning') return v || 'on'
    if (k === 'thinking') return v === 'false' ? 'off' : 'on'
  }
  return null
}

/**
 * 只读思考徽标条件：primary 无独立思考档（rank2）时，取模型项尾缀档位；否则返回 null。
 */
export function selectReadonlyModelThinking(primary: AcpConfigOption[]): string | null {
  if (primary.some((o) => rankPrimary(o) === 2)) return null
  const model = primary.find((o) => rankPrimary(o) === 1)
  if (!model) return null
  return extractModelSuffixThinking(model.currentValue)
}
