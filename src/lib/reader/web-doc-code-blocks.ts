import type { EpubThemeMode } from '@/lib/reader/epub-themes'
import { READER_PALETTE } from '@/lib/reader/epub-themes'
import { buildCodeBlockToolbarHtml } from '@/lib/preview/code-block-chrome'

const LANGUAGE_CLASS = /\blanguage-([\w-]+)\b/i
const LANG_CLASS = /\blang-([\w-]+)\b/i

function detectCodeLanguage(node: Element): string {
  const sources = [
    node.className,
    node.querySelector('code')?.className ?? '',
    node.parentElement?.className ?? '',
  ]

  for (const source of sources) {
    const language = source.match(LANGUAGE_CLASS)?.[1] ?? source.match(LANG_CLASS)?.[1]
    if (language) return language.toLowerCase()
  }

  return 'text'
}

function isLanguageWrapper(div: HTMLElement): boolean {
  if (div.classList.contains('code-block')) return false
  if (LANGUAGE_CLASS.test(div.className) || LANG_CLASS.test(div.className) || div.classList.contains('highlight')) {
    return true
  }
  return false
}

function isPreOnlyWrapper(div: HTMLElement): boolean {
  return [...div.childNodes].every((node) => {
    if (node.nodeType === Node.TEXT_NODE) return !node.textContent?.trim()
    return node instanceof HTMLPreElement
  })
}

function collectCodeBlockHosts(root: ParentNode): HTMLElement[] {
  const hosts: HTMLElement[] = []
  const seen = new Set<HTMLElement>()

  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.closest('.code-block')) return
    const text = pre.textContent?.replace(/\u00a0/g, ' ').trim()
    if (!text) return

    const parent = pre.parentElement
    if (parent && parent !== root && parent.tagName === 'DIV' && isLanguageWrapper(parent) && isPreOnlyWrapper(parent)) {
      if (!seen.has(parent)) {
        seen.add(parent)
        hosts.push(parent)
      }
      return
    }

    if (!seen.has(pre)) {
      seen.add(pre)
      hosts.push(pre)
    }
  })

  return hosts
}

function wrapCodeBlockHost(host: HTMLElement): void {
  const pre = host.tagName === 'PRE' ? host : host.querySelector('pre')
  if (!pre) return

  const lang = detectCodeLanguage(host)
  const doc = host.ownerDocument
  const wrapper = doc.createElement('div')
  wrapper.className = 'code-block'
  wrapper.innerHTML = buildCodeBlockToolbarHtml(lang)

  const body = doc.createElement('div')
  body.className = 'code-block-body'
  wrapper.appendChild(body)

  const parent = host.parentNode
  if (!parent) return

  parent.insertBefore(wrapper, host)
  body.appendChild(pre)
  if (host !== pre) {
    host.remove()
  }
}

/** 为在线文档正文中的 pre/code 注入与 Markdown 预览一致的复制工具栏 */
export function enhanceWebDocCodeBlocks(html: string): string {
  if (!html.includes('<pre')) return html

  const doc = new DOMParser().parseFromString(`<div id="web-doc-code-root">${html}</div>`, 'text/html')
  const root = doc.getElementById('web-doc-code-root')
  if (!root) return html

  for (const host of collectCodeBlockHosts(root)) {
    wrapCodeBlockHost(host)
  }

  return root.innerHTML
}

export function buildWebDocCodeBlockCss(mode: EpubThemeMode): string {
  const palette = READER_PALETTE[mode]
  const border = mode === 'dark' ? '#3f3f46' : '#e4e4e7'
  const surface = mode === 'dark' ? '#27272a' : '#f4f4f5'
  const toolbar = mode === 'dark' ? '#1f1f23' : '#ececee'
  const copyBg = mode === 'dark' ? '#18181b' : '#fafafa'
  const muted = mode === 'dark' ? '#a1a1aa' : '#71717a'
  const primary = mode === 'dark' ? '#fafafa' : '#18181b'

  return `
    .code-block {
      margin: 1em 0 !important;
      overflow: hidden !important;
      border: 1px solid ${border} !important;
      border-radius: 0.5rem !important;
      background: ${surface} !important;
    }
    .code-block-toolbar {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 0.75rem !important;
      border-bottom: 1px solid ${border} !important;
      background: ${toolbar} !important;
      padding: 0.375rem 0.625rem !important;
    }
    .code-block-lang {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      font-size: 0.75rem !important;
      font-weight: 500 !important;
      color: ${muted} !important;
      text-transform: lowercase !important;
    }
    .code-block-copy {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      border: 1px solid ${border} !important;
      border-radius: 0.375rem !important;
      background: ${copyBg} !important;
      padding: 0.25rem !important;
      color: ${muted} !important;
      cursor: pointer !important;
    }
    .code-block-copy:hover {
      border-color: ${primary} !important;
      color: ${primary} !important;
    }
    .code-block-copy.copied {
      border-color: ${muted} !important;
      color: ${primary} !important;
    }
    .code-block-body {
      overflow-x: auto !important;
    }
    .code-block pre {
      margin: 0 !important;
      padding: 1rem !important;
      overflow-x: auto !important;
      background: transparent !important;
      border-radius: 0 !important;
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
    .code-block pre code {
      background: transparent !important;
      padding: 0 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      font-size: 0.875em !important;
      color: ${palette.text} !important;
    }
    .code-block .token {
      background: transparent !important;
    }
  `
}
