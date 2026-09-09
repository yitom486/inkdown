/**
 * OCR 目录操作互斥（探测 / 正式识别 / 保存校正目录）。
 *
 * 背景：三个布尔 state（tocDetecting / ocrRecognizing / ocrTocSaving）要等
 * 下一次渲染才翻转，快速连续点击能绕过“if (busy) return”——后写入的
 * auto/reviewed 缓存会静默覆盖前者。本模块给同步锁（ref 持有，无渲染延迟），
 * 布尔 state 只负责按钮禁用等渲染。锁协议：
 * - 先 tryBegin，失败即 occupier 忙（调用方弹 busy 提示）；
 * - 成功路径末尾与所有失败/参数错误路径都走 end（调用方 finally 保证）。
 */

export type OcrTocOperation = 'detect' | 'recognize' | 'save'

export const TOC_OP_LABELS: Record<OcrTocOperation, string> = {
  detect: '目录页探测',
  recognize: '目录识别',
  save: '目录保存',
}

/** 校正编辑器有未保存草稿时，探测/识别必须先让人保存或取消（防静默覆盖） */
export const TOC_DRAFT_GUARD_MESSAGE = '校正目录有未保存草稿，请先保存或取消'

export interface TocOpLock {
  current(): OcrTocOperation | null
  /** 空闲时占住并返回 true；被占返回 false（调用方负责提示） */
  tryBegin(operation: OcrTocOperation): boolean
  /** 只有占住者本人能释放；别人的 end 是空操作 */
  end(operation: OcrTocOperation): void
}

export function createTocOpLock(): TocOpLock {
  let running: OcrTocOperation | null = null
  return {
    current: () => running,
    tryBegin: (operation) => {
      if (running !== null) return false
      running = operation
      return true
    },
    end: (operation) => {
      if (running === operation) running = null
    },
  }
}

/** 是否可开始 next（running 为空才行；纯判定，给单测与调用方） */
export function canBeginTocOp(
  running: OcrTocOperation | null,
  _next: OcrTocOperation,
): boolean {
  void _next
  return running === null
}

/** 占线时的忙提示（null 表示空闲）；调用方在 tryBegin 失败时展示 */
export function tocBusyMessage(running: OcrTocOperation | null): string | null {
  if (running === null) return null
  return `${TOC_OP_LABELS[running]}进行中，请稍候`
}

