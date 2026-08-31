/** 轮询 DOM 就绪（章节跳转、iframe load 后定位摘录）。 */
export async function waitForDom<T>(
  probe: () => T | null | undefined,
  options?: { attempts?: number; delayMs?: number },
): Promise<T | null> {
  const attempts = options?.attempts ?? 24
  const delayMs = options?.delayMs ?? 50
  for (let i = 0; i < attempts; i++) {
    const value = probe()
    if (value) return value
    await new Promise((resolve) => window.setTimeout(resolve, delayMs))
  }
  return probe() ?? null
}
