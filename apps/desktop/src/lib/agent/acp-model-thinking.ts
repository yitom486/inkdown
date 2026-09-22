import type { AcpConfigOption } from '@inkdown/contracts'
import { rankPrimary } from './acp-config-menu'
import type { AcpPreferredConfigMap } from './acp-config-preferences'

/** 尾缀档位可设：思考类 key（`name[k=v,…]` 内嵌）与 `fast` 开关均编码在模型值尾缀。 */
export const MODEL_THINKING_KEYS = [
  'reasoning_effort',
  'effort',
  'reasoning',
  'thinking',
] as const

const THINKING_SET = new Set<string>(MODEL_THINKING_KEYS)

export interface ModelVariant {
  base: string
  params: Record<string, string>
}

/**
 * 解析模型 variant：`name[k=v,…]` → `{ base, params }`。
 * 无尾缀回退 `{ base: 全串, params: {} }`；空尾缀（`default[]`）回退 params `{}`；
 * 裸值段（无 `=`，如 `m[high]`）跳过（由 `extractModelSuffixThinking` 负责只读展示）。
 */
export function parseModelVariant(value: unknown): ModelVariant {
  if (typeof value !== 'string') return { base: '', params: {} }
  const text = value.trim()
  if (!text) return { base: '', params: {} }
  const m = /\[(.*)\]$/.exec(text)
  if (!m) return { base: text, params: {} }
  const base = text.slice(0, m.index).trim()
  const raw = m[1]!.trim()
  const params: Record<string, string> = {}
  if (!raw) return { base, params }
  for (const part of raw.split(',')) {
    const seg = part.trim()
    if (!seg) continue
    const eq = seg.indexOf('=')
    if (eq < 0) continue
    const k = seg.slice(0, eq).trim()
    const v = seg.slice(eq + 1).trim()
    if (!k) continue
    params[k] = v
  }
  return { base, params }
}

/**
 * 组装模型 variant：`k=v` 逗号 join，保持传入对象 key 顺序（新 key 追加到末尾）；
 * 空 params 输出 `base[]`。
 */
export function buildModelVariant(base: string, params: Record<string, string>): string {
  const inner = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(',')
  return `${base}[${inner}]`
}

/** params 按插入顺序取首个思考类 key；无则返回 null。 */
export function findVariantThinkingKey(params: Record<string, string>): string | null {
  for (const k of Object.keys(params)) {
    if (THINKING_SET.has(k)) return k
  }
  return null
}

/**
 * 同 base variant 的思考类 key 值去重（保持首见顺序）。
 * 调用方判定 `≥2` 才可设下拉；单 variant（如 grok-4.7）仅 1 个，不可用。
 */
export function collectThinkingCandidates(
  currentBase: string,
  allValues: readonly unknown[],
): string[] {
  const base = currentBase.trim()
  if (!base) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of allValues) {
    if (typeof item !== 'string') continue
    const parsed = parseModelVariant(item)
    if (parsed.base !== base) continue
    for (const k of Object.keys(parsed.params)) {
      if (!THINKING_SET.has(k)) continue
      const v = parsed.params[k]!.trim()
      if (!v || seen.has(v)) continue
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

/**
 * 同 key 跨模型收集作后备：同 base 不足 2 个时用，key 对齐当前模型的思考 key。
 * 非思考 key 直接返回 []。
 */
export function collectThinkingCandidatesAcrossKeys(
  currentThinkingKey: string,
  allValues: readonly unknown[],
): string[] {
  const key = currentThinkingKey.trim()
  if (!key || !THINKING_SET.has(key)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of allValues) {
    if (typeof item !== 'string') continue
    const parsed = parseModelVariant(item)
    if (!(key in parsed.params)) continue
    const v = parsed.params[key]!.trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}
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

export interface ModelThinkingControl {
  configId: string
  base: string
  key: string
  current: string
  params: Record<string, string>
  candidates: string[]
}

function modelOptionValues(model: AcpConfigOption): string[] {
  const listed = (model.options ?? [])
    .map((o) => o.value)
    .filter((v): v is string => typeof v === 'string')
  const current =
    typeof model.currentValue === 'string' ? [model.currentValue] : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of [...listed, ...current]) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/**
 * 可设思考下拉条件（只读徽标升级版）：无 rank2 且当前模型尾缀含思考类 key，
 * 同 base 候选≥2 直接用，不足时按同 key 跨模型后备≥2 才返回；否则返回 null（保持只读徽标）。
 * current 兜底并入候选首位，保证下拉 value 始终合法。
 */
export function selectModelThinkingControl(
  primary: AcpConfigOption[],
): ModelThinkingControl | null {
  if (primary.some((o) => rankPrimary(o) === 2)) return null
  const model = primary.find((o) => rankPrimary(o) === 1)
  if (!model || typeof model.currentValue !== 'string') return null
  const parsed = parseModelVariant(model.currentValue)
  if (!parsed.base) return null
  const key = findVariantThinkingKey(parsed.params)
  if (!key) return null
  const current = parsed.params[key]!.trim()
  if (!current) return null
  const allValues = modelOptionValues(model)
  let candidates = collectThinkingCandidates(parsed.base, allValues)
  if (candidates.length < 2) {
    candidates = collectThinkingCandidatesAcrossKeys(key, allValues)
  }
  if (!candidates.includes(current)) candidates = [current, ...candidates]
  if (candidates.length < 2) return null
  return {
    configId: model.configId,
    base: parsed.base,
    key,
    current,
    params: parsed.params,
    candidates,
  }
}

export interface SuffixFastState {
  configId: string
  base: string
  checked: boolean
  params: Record<string, string>
}

/**
 * 尾缀版 fast 开关状态：模型尾缀含 `fast=true|false` 时返回，否则 null。
 * 有值时优先于 boolean 版 `findFastToggle`（两者互斥，尾缀优先）。
 */
export function selectSuffixFastState(
  primary: AcpConfigOption[],
): SuffixFastState | null {
  const model = primary.find((o) => rankPrimary(o) === 1)
  if (!model || typeof model.currentValue !== 'string') return null
  const parsed = parseModelVariant(model.currentValue)
  if (!parsed.base) return null
  if (!('fast' in parsed.params)) return null
  const raw = parsed.params['fast']!.trim()
  if (raw !== 'true' && raw !== 'false') return null
  return {
    configId: model.configId,
    base: parsed.base,
    checked: raw === 'true',
    params: parsed.params,
  }
}

/**
 * fast 尾缀默认关一次的纯决策（`selectFastDefaultOffTarget` 的尾缀版）：
 * 当前模型 `fast=true` 且无该 runtime+model 存储偏好时，返回改写 `fast=false` 的新模型 id；
 * 有偏好/已 false/无 fast 参数/无模型项一律返回 null。调用方负责 set + remember，失败 warn 不抛。
 */
export function selectFastSuffixDefaultOffTarget(
  options: AcpConfigOption[],
  preferredByRuntime: AcpPreferredConfigMap,
  runtimeId: string,
): { configId: string; value: string } | null {
  const rid = runtimeId.trim()
  if (!rid) return null
  const model = options.find((o) => rankPrimary(o) === 1)
  if (!model || typeof model.currentValue !== 'string') return null
  const cid = String(model.configId ?? '').trim()
  if (!cid) return null
  const stored = preferredByRuntime[rid]?.[cid]
  if (stored != null && stored !== '') return null
  const parsed = parseModelVariant(model.currentValue)
  if (!('fast' in parsed.params)) return null
  if (parsed.params['fast'] !== 'true') return null
  const value = buildModelVariant(parsed.base, { ...parsed.params, fast: 'false' })
  if (value === model.currentValue) return null
  return { configId: model.configId, value }
}
