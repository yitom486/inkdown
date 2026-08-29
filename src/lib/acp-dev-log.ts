/** 仅开发环境输出的 ACP 诊断日志；生产构建为 no-op。 */
export function acpDevLog(message: string, data?: unknown): void {
  if (!import.meta.env.DEV) return
  if (data === undefined) {
    console.info(`[acp-dev] ${message}`)
    return
  }
  console.info(`[acp-dev] ${message}`, data)
}

export function acpDevWarn(message: string, data?: unknown): void {
  if (!import.meta.env.DEV) return
  if (data === undefined) {
    console.warn(`[acp-dev] ${message}`)
    return
  }
  console.warn(`[acp-dev] ${message}`, data)
}
