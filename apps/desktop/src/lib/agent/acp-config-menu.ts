import type { AcpConfigOption } from '@inkdown/contracts'

/** Agent 会话 configOption 的输入栏分类与排序（AgentPanel 纯逻辑出库，便于单测） */

const SELECT_CATEGORIES = new Set(['model', 'mode', 'thought_level', 'model_config'])

export function isSelectOption(o: AcpConfigOption): boolean {
  if (o.type === 'boolean') return false
  if (!o.options || o.options.length === 0) return false
  if (o.category && SELECT_CATEGORIES.has(o.category)) return true
  return /model|mode|thought|reason|fast|collab/i.test(o.configId + o.name)
}

/**
 * 输入栏只放最常改的三项，对齐 Codex/Cursor：
 * 0=模式（不含 collab）、1=模型、2=思考档；其余返回 null 归入「更多设置」。
 */
export function rankPrimary(o: AcpConfigOption): number | null {
  const id = `${o.configId} ${o.category ?? ''} ${o.name}`.toLowerCase()
  if (/(^|\s)mode(\s|$)/.test(id) && !/collab|model/.test(id)) return 0
  if (o.category === 'mode' && !/collab/i.test(o.name)) return 0
  if (o.category === 'model' || /(^|\s)model(\s|$)/.test(id)) return 1
  if (/thought|reason/.test(id) || o.category === 'thought_level') return 2
  return null
}

/** 命中同一 rank 的第二个起进 secondary，primary 按 0/1/2 定序 */
export function splitConfigOptions(options: AcpConfigOption[]): {
  primary: AcpConfigOption[]
  secondary: AcpConfigOption[]
} {
  const selects = options.filter(isSelectOption)
  const primary: AcpConfigOption[] = []
  const secondary: AcpConfigOption[] = []
  const byRank = new Map<number, AcpConfigOption>()

  for (const opt of selects) {
    const rank = rankPrimary(opt)
    if (rank === null) {
      secondary.push(opt)
      continue
    }
    if (!byRank.has(rank)) byRank.set(rank, opt)
    else secondary.push(opt)
  }

  for (const rank of [0, 1, 2]) {
    const opt = byRank.get(rank)
    if (opt) primary.push(opt)
  }

  return { primary, secondary }
}

/** 紧凑菜单按钮文案：当前选项名，缺省回退选项组名 */
export function currentLabel(opt: AcpConfigOption): string {
  const value = String(opt.currentValue ?? '')
  const match = opt.options?.find((item) => item.value === value)
  return match?.name ?? (value || opt.name)
}
