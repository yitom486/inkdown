/** 统一为 LF，避免 Windows CRLF 与 CodeMirror 内部文档不一致导致误判 dirty */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}
