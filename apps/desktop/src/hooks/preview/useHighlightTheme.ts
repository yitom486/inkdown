import { useEffect } from 'react'
import githubTheme from 'highlight.js/styles/github.min.css?url'
import githubDarkTheme from 'highlight.js/styles/github-dark.min.css?url'
import type { AppTheme } from '@/stores/editor-ui-store'

const HIGHLIGHT_THEME_LINK_ID = 'markdown-preview-hljs-theme'

/** 预览与 Agent 气泡共用同一套 hljs 主题（随应用亮/暗切换） */
export function useHighlightTheme(theme: AppTheme) {
  useEffect(() => {
    let link = document.getElementById(HIGHLIGHT_THEME_LINK_ID) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = HIGHLIGHT_THEME_LINK_ID
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }

    link.href = theme === 'dark' ? githubDarkTheme : githubTheme
  }, [theme])
}
