const BLOCKED_PROTOCOLS = new Set(['file:', 'javascript:', 'data:', 'blob:'])

/** 仅允许 http(s) 在线文档 URL */
export function assertWebDocUrlAllowed(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    throw new Error('URL 格式无效')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('仅支持 http / https 链接')
  }
  if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('不支持的 URL 协议')
  }
  if (!parsed.hostname) {
    throw new Error('URL 缺少主机名')
  }

  return parsed
}

export function normalizeWebDocUrl(raw: string): string {
  const url = assertWebDocUrlAllowed(raw)
  url.hash = ''
  return url.toString()
}
