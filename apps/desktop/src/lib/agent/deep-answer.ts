/**
 * 一键深度问答（P2，见 `.plan/ai-cards/01-card-studio-plan.md`）。
 * 同制卡走一书一会话（上下文连贯，"上文那个论证"能接上），
 * 答案落对话框，不污染右侧时间线（沿 quiz 副会话隔离模式）。
 * composer 追问入口原样保留——本模块只管一键直答三方向。
 */

export type DeepAnswerDirectionId = 'explain' | 'summary' | 'compare'

export interface DeepAnswerDirection {
  id: DeepAnswerDirectionId
  /** 菜单按钮文案（用户只选这个） */
  label: string
  directive: string
}

export const DEEP_ANSWER_DIRECTIONS: readonly DeepAnswerDirection[] = [
  {
    id: 'explain',
    label: '深入解释',
    directive: '深入解释并解构此段的核心内涵：关键概念、论证链条逐段讲清。',
  },
  {
    id: 'summary',
    label: '精要摘要',
    directive: '提炼此段内容的精要摘要：一句话主张 + 不超过 3 条要点。',
  },
  {
    id: 'compare',
    label: '对比分析',
    directive: '对比分析其他章节或文献中关于此观点的异同：相同处、相异处分开写，不确定的标"待核实"。',
  },
]

const directionById = new Map<DeepAnswerDirectionId, DeepAnswerDirection>(
  DEEP_ANSWER_DIRECTIONS.map((direction) => [direction.id, direction]),
)

export function getDeepAnswerDirection(id: string): DeepAnswerDirection | null {
  return directionById.get(id as DeepAnswerDirectionId) ?? null
}

/** 组装问答 prompt：方向 directive + 原文（无自定义输入，纯选择题） */
export function buildDeepAnswerPrompt(excerpt: string, direction: DeepAnswerDirection): string {
  return `你是读书问答助手。直接回答，不要反问，不要输出 JSON。\n\n${direction.directive}\n\n<原文>\n${excerpt.trim()}\n</原文>`
}
