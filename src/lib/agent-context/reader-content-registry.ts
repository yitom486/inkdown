/** 单次返回给 Agent 的正文上限：一章再长也不该一次灌满上下文 */
export const READER_TEXT_MAX_CHARS = 20_000

export interface ReaderContentProvider {
  /** provider 所属文件，切档时用于校验，避免返回上一本书的内容 */
  filePath: string
  /** 当前章节 / 页的纯文本；EPUB/MOBI 取 iframe DOM，PDF 取 textContent，MD 取编辑器内容 */
  getCurrentText: () => Promise<string> | string
}

let current: ReaderContentProvider | null = null

/**
 * 各 Viewer 在 mount 时注册，unmount 时注销。
 * 同一时刻只有一个主区文档，因此只保留最后注册的那个。
 */
export function registerReaderContent(provider: ReaderContentProvider): () => void {
  current = provider
  return () => {
    if (current === provider) current = null
  }
}

/** 折叠空白并截断，避免把整本书塞进一次工具返回 */
export function normalizeReaderText(raw: string, maxChars = READER_TEXT_MAX_CHARS): string {
  const text = raw.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n\n…[已截断：本章过长，仅返回前 ${maxChars} 字]`
}

export async function readCurrentDocumentText(expectedFilePath?: string): Promise<string> {
  const provider = current
  if (!provider) {
    throw new Error('当前没有打开的文档，或该格式暂不支持提取正文')
  }
  if (expectedFilePath && provider.filePath !== expectedFilePath) {
    throw new Error('文档刚刚切换，请重新获取当前文档信息后再试')
  }
  return normalizeReaderText(await provider.getCurrentText())
}
