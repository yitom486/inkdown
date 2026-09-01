/** 在线文档站点适配器 id */
export type WebDocSiteId = 'generic-ssr' | 'react-dev' | 'people-daily-paper'

export interface WebDocFetchPayload {
  url: string
}

/** 主进程 fetch 原始 HTML（未消毒） */
export interface WebDocFetchResult {
  /** 跟随重定向后的最终 URL */
  url: string
  html: string
}

export interface WebDocDiscoverTocPayload {
  /** 文档入口 URL（用于确定 origin 与适配器） */
  url: string
}

export interface WebDocTocEntry {
  href: string
  label: string
  level: number
}

export interface WebDocDiscoverTocResult {
  siteId: WebDocSiteId
  entries: WebDocTocEntry[]
}

/** 渲染端净化后的单页阅读内容 */
export interface WebDocPageContent {
  title: string
  bodyHtml: string
  baseUrl: string
  siteId: WebDocSiteId
}
