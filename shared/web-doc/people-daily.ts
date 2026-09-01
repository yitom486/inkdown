/** 人民日报电子版（paper.people.com.cn）路径与站点识别 */

export function isPeopleDailyPaperHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'paper.people.com.cn' || host.endsWith('.paper.people.com.cn')
}

/** 当期版面目录 URL，如 …/content/202609/01/ 或 …/layout/202609/01/ */
export function resolvePeopleDailyEditionUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl)
    const contentMatch = url.pathname.match(/^(.*\/content\/\d{6}\/\d{2}\/)/)
    if (contentMatch?.[1]) return `${url.origin}${contentMatch[1]}`
    const layoutMatch = url.pathname.match(/^(.*\/layout\/\d{6}\/\d{2}\/)/)
    if (layoutMatch?.[1]) return `${url.origin}${layoutMatch[1]}`
    return null
  } catch {
    return null
  }
}

export function isPeopleDailyLayoutPath(pathnameOrUrl: string): boolean {
  try {
    const pathname = pathnameOrUrl.includes('://')
      ? new URL(pathnameOrUrl).pathname
      : pathnameOrUrl
    return /\/layout\/\d{6}\/\d{2}\/node_\d+\.html$/i.test(pathname)
  } catch {
    return false
  }
}
