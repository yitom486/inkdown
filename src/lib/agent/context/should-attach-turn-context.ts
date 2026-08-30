/** 未换文件时，每隔多少轮重新提醒一次工作区状态 */
export const TURN_CONTEXT_INTERVAL = 5

export interface TurnContextTrackerState {
  /** 距离上次附加 turn-context 已经过去的轮数 */
  turnsSinceAttach: number
  /** 上次附加时的 documentKey */
  lastDocumentKey: string | null
  /** 是否已经附加过至少一次 */
  attachedOnce: boolean
}

export interface TurnContextDecision {
  attach: boolean
  documentChanged: boolean
  next: TurnContextTrackerState
}

export function createTurnContextTrackerState(): TurnContextTrackerState {
  return { turnsSinceAttach: 0, lastDocumentKey: null, attachedOnce: false }
}

/**
 * 决定本轮是否附加 turn-context。
 *
 * 附加条件（满足其一）：
 * 1. 打开的文档发生变化（含首次打开、关闭文档）；
 * 2. 距离上次附加已达 `interval` 轮；
 * 3. 本轮有**新的**用户选区待通知（仅带 hasSelection 一次；正文走工具，下轮默认不再带）。
 *
 * 附加后计数清零，避免每轮都拼装、把上下文撑满。
 */
export function decideTurnContext(
  state: TurnContextTrackerState,
  currentDocumentKey: string | null,
  interval = TURN_CONTEXT_INTERVAL,
  hasSelection = false,
): TurnContextDecision {
  const documentChanged = state.attachedOnce
    ? currentDocumentKey !== state.lastDocumentKey
    : currentDocumentKey !== null

  const intervalReached = state.attachedOnce && state.turnsSinceAttach + 1 >= interval
  const attach = documentChanged || intervalReached || hasSelection

  if (!attach) {
    return {
      attach: false,
      documentChanged: false,
      next: { ...state, turnsSinceAttach: state.turnsSinceAttach + 1 },
    }
  }

  return {
    attach: true,
    documentChanged,
    next: {
      turnsSinceAttach: 0,
      lastDocumentKey: currentDocumentKey,
      attachedOnce: true,
    },
  }
}

/** 按对话线程保存计数：仅内存，切换/删除线程后自然失效 */
const trackerByThread = new Map<string, TurnContextTrackerState>()

export function takeTurnContextDecision(
  threadId: string,
  currentDocumentKey: string | null,
  interval = TURN_CONTEXT_INTERVAL,
  hasSelection = false,
): TurnContextDecision {
  const state = trackerByThread.get(threadId) ?? createTurnContextTrackerState()
  const decision = decideTurnContext(state, currentDocumentKey, interval, hasSelection)
  trackerByThread.set(threadId, decision.next)
  return decision
}

export function resetTurnContextTracker(threadId?: string): void {
  if (threadId) {
    trackerByThread.delete(threadId)
    return
  }
  trackerByThread.clear()
}
