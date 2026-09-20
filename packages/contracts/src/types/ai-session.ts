/**
 * AI 制卡工作室一书一会话（P1，见 `.plan/ai-cards/01-card-studio-plan.md`）。
 * 行归属键与 marks/quiz 同键（`fileFingerprint`，未索引书回落归一化路径哈希，
 * 调用方保证，库内不做归一化）。
 * 只记会话指针与计数，不存消息明文（上下文在运行时侧）。
 */

export interface AiSessionRecord {
  bookFingerprint: string
  purpose: string
  sessionId: string
  promptCount: number
  lastUsedAt: number
  createdAt: number
  updatedAt: number
}

/** `ai-sessions:get` 请求 */
export interface AiSessionGetPayload {
  bookFingerprint: string
  purpose?: string
}

/** `ai-sessions:put` 请求（upsert 整行；createdAt 仅首写有效） */
export interface AiSessionPutPayload {
  bookFingerprint: string
  purpose?: string
  sessionId: string
  promptCount: number
  lastUsedAt: number
}

/** `ai-sessions:touch` 请求（prompt 成功后计数 + 保活） */
export interface AiSessionTouchPayload {
  bookFingerprint: string
  purpose?: string
}
