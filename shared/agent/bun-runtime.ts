/** Agent 通过 bunx 启动时，是否像「未安装 Bun」导致的错误 */
export function isLikelyBunMissingMessage(message: string): boolean {
  const lower = message.toLowerCase()
  if (!lower.includes('bun')) return false
  return (
    lower.includes('enoent') ||
    lower.includes('not found') ||
    lower.includes('not recognized') ||
    lower.includes('不是内部或外部命令') ||
    lower.includes('无法将') ||
    lower.includes('command not found') ||
    (lower.includes('spawn') && lower.includes('bun'))
  )
}

export function bunNotInstalledMessage(): string {
  return '未检测到 Bun。Agent 需通过 bunx 启动 Codex，请先安装 Bun（安装后请完全退出并重新打开 Inkdown）。'
}
