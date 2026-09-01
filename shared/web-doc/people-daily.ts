/** 人民日报电子版（paper.people.com.cn）路径与站点识别 */

export function isPeopleDailyPaperHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'paper.people.com.cn' || host.endsWith('.paper.people.com.cn')
}

/** 当期版面目录 URL，如 …/content/202609/01/ */
export function resolvePeopleDailyEditionUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl)
    const match = url.pathname.match(/^(.*\/content\/\d{6}\/\d{2}\/)/)
    if (!match?.[1]) return null
    return `${url.origin}${match[1]}`
  } catch {
    return null
  }
}
