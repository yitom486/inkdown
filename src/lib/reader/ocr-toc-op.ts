/**
 * OCR 目录操作互斥（探测 / 正式识别 / 保存校正目录）：租约锁 + 文档世代。
 *
 * 背景：三个布尔 state 要等下一次渲染，快速连点能绕过“if (busy) return”——
 * 后写入的 auto/reviewed 缓存会静默覆盖前者；且旧版按操作名释放，
 * 切文件后旧 recognize 的 finally 会误释放新文件的同名锁（ABA）。
 *
 * 模型：
 * - tryBegin 成功返回租约对象（单调 id + 操作名），失败返回 null；
 *   租约是引用，不可伪造，释放只认引用相等，不认操作名。
 * - end 只有当前租约本人能释放；别人的 end、重复 end 都是空操作。
 * - invalidate 切断当前租约（切文件时调用）：旧 finally 的 end 不再生效，
 *   即使新请求操作同名。
 * - 文档世代（PdfViewer 侧单调计数，见 isLiveTocOpLease）：切文件即 +1，
 *   异步回调写回前必须同时通过“租约仍是当前”与“世代未变”两道门。
 */

export type OcrTocOperation = 'detect' | 'recognize' | 'save'

export const TOC_OP_LABELS: Record<OcrTocOperation, string> = {
  detect: '目录页探测',
  recognize: '目录识别',
  save: '目录保存',
}

/** 校正编辑器有未保存草稿时，探测/识别必须先让人保存或取消（防静默覆盖） */
export const TOC_DRAFT_GUARD_MESSAGE = '校正目录有未保存草稿，请先保存或取消'

export interface TocOpLease {
  /** 锁内单调递增，调试与单测断言用；所有权按引用判定 */
  readonly id: number
  readonly operation: OcrTocOperation
}

export interface TocOpLock {
  current(): TocOpLease | null
  /** 空闲时占住并返回租约；被占返回 null（调用方负责忙提示） */
  tryBegin(operation: OcrTocOperation): TocOpLease | null
  /** 仅当前租约本人能释放，返回是否释放；其余一律空操作返回 false */
  end(lease: TocOpLease): boolean
  /** 作废当前租约（切文件）：旧 finally 的 end 不再生效 */
  invalidate(): void
}

export function createTocOpLock(): TocOpLock {
  let running: TocOpLease | null = null
  let nextId = 1
  return {
    current: () => running,
    tryBegin: (operation) => {
      if (running !== null) return null
      const lease: TocOpLease = { id: nextId, operation }
      nextId += 1
      running = lease
      return lease
    },
    end: (lease) => {
      if (running === null || running !== lease) return false
      running = null
      return true
    },
    invalidate: () => {
      running = null
    },
  }
}

/** 是否可开始 next（无当前租约才行；纯判定，给单测与调用方） */
export function canBeginTocOp(
  running: TocOpLease | null,
  _next: OcrTocOperation,
): boolean {
  void _next
  return running === null
}

/** 占线时的忙提示（null 表示空闲）；调用方在 tryBegin 失败时展示 */
export function tocBusyMessage(running: TocOpLease | null): string | null {
  if (running === null) return null
  return `${TOC_OP_LABELS[running.operation]}进行中，请稍候`
}

/**
 * 异步回写门：租约仍是当前持有者 **且** 文档世代未变，才允许修改
 * 目录 UI / 范围 / notice / toast。切文件（invalidate + 世代 +1）后，
 * 旧任务的任何回写一律拦下；旧 finally 的清 busy 同样被拦，
 * 新任务的 busy 状态不会被旧任务清掉。
 */
export function isLiveTocOpLease(
  current: TocOpLease | null,
  lease: TocOpLease | null,
  currentSession: number,
  session: number,
): boolean {
  return lease !== null && current === lease && currentSession === session
}
