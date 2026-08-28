/** 正文左右留白（百分比）：两侧各 5%，正文占中间 90% */
export const EPUB_CONTENT_HORIZONTAL_PADDING = '5%'

const EPUB_CONTENT_VERTICAL_PADDING = '1.75rem'

const READER_LAYOUT_STYLE_ID = 'reader-layout-styles'

/** epub.js themes 规则：覆盖书内默认蓝链与字体 */
export function getEpubThemeRules(mode: 'dark' | 'light'): Record<string, Record<string, string>> {
  const serif = '"Source Han Serif SC", "Noto Serif SC", "Songti SC", Georgia, serif'
  const sans = '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
  const horizontalPadding = EPUB_CONTENT_HORIZONTAL_PADDING
  const pageBackground = mode === 'dark' ? '#18181b' : '#fafafa'

  const sharedBody = {
    background: pageBackground,
    'font-family': serif,
    'font-size': '18px',
    'line-height': '1.85',
    'padding-top': `${EPUB_CONTENT_VERTICAL_PADDING} !important`,
    'padding-bottom': `${EPUB_CONTENT_VERTICAL_PADDING} !important`,
    'padding-left': `${horizontalPadding} !important`,
    'padding-right': `${horizontalPadding} !important`,
    'letter-spacing': '0.02em',
    'overflow-y': 'visible',
    'min-height': '100%',
    width: '100% !important',
    'max-width': '100% !important',
    'box-sizing': 'border-box',
    margin: '0 !important',
  }

  const sharedHtml = {
    background: pageBackground,
    'overflow-y': 'auto !important',
    'overflow-x': 'hidden !important',
    height: '100%',
    width: '100% !important',
    'scrollbar-gutter': 'stable',
  }

  if (mode === 'dark') {
    return {
      body: {
        ...sharedBody,
        color: '#d4d4d8',
      },
      html: sharedHtml,
      p: {
        'margin-bottom': '1em',
        'text-align': 'justify',
      },
      a: {
        color: '#a1a1aa !important',
        'text-decoration': 'none !important',
        border: 'none !important',
      },
      'a:hover': {
        color: '#e4e4e7 !important',
      },
      h1: {
        color: '#fafafa',
        'font-family': sans,
        'font-size': '1.6em',
        'font-weight': '600',
        'margin-bottom': '0.75em',
      },
      h2: {
        color: '#f4f4f5',
        'font-family': sans,
        'font-size': '1.35em',
        'font-weight': '600',
      },
      h3: {
        color: '#e4e4e7',
        'font-family': sans,
        'font-size': '1.15em',
        'font-weight': '600',
      },
      li: {
        'margin-bottom': '0.35em',
      },
      nav: {
        display: 'none !important',
      },
    }
  }

  return {
    body: {
      ...sharedBody,
      color: '#3f3f46',
    },
    html: sharedHtml,
    p: {
      'margin-bottom': '1em',
      'text-align': 'justify',
    },
    a: {
      color: '#71717a !important',
      'text-decoration': 'none !important',
      border: 'none !important',
    },
    'a:hover': {
      color: '#27272a !important',
    },
    h1: {
      color: '#18181b',
      'font-family': sans,
      'font-size': '1.6em',
      'font-weight': '600',
    },
    h2: {
      color: '#27272a',
      'font-family': sans,
      'font-size': '1.35em',
      'font-weight': '600',
    },
    h3: {
      color: '#3f3f46',
      'font-family': sans,
      'font-size': '1.15em',
      'font-weight': '600',
    },
    nav: {
      display: 'none !important',
    },
  }
}

function buildReaderLayoutCss(): string {
  const h = EPUB_CONTENT_HORIZONTAL_PADDING
  const v = EPUB_CONTENT_VERTICAL_PADDING

  return `
    html {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      scrollbar-gutter: stable;
      box-sizing: border-box !important;
    }
    body {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding-top: ${v} !important;
      padding-bottom: ${v} !important;
      padding-left: ${h} !important;
      padding-right: ${h} !important;
      box-sizing: border-box !important;
    }
    body > div,
    body > section,
    body > article,
    body > main,
    [class*="calibre"] {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      float: none !important;
      box-sizing: border-box !important;
    }
    img, svg, video {
      max-width: 100% !important;
      height: auto !important;
    }
  `
}

function syncEpubReadingInlineStyles(doc: Document): void {
  const html = doc.documentElement
  const body = doc.body
  if (!body) return

  const important = (el: HTMLElement, prop: string, value: string) => {
    el.style.setProperty(prop, value, 'important')
  }

  important(html, 'width', '100%')
  important(html, 'max-width', '100%')
  important(html, 'margin', '0')
  important(html, 'overflow-x', 'hidden')
  important(html, 'overflow-y', 'auto')
  important(html, 'scrollbar-gutter', 'stable')

  important(body, 'width', '100%')
  important(body, 'max-width', '100%')
  important(body, 'margin', '0')
  important(body, 'box-sizing', 'border-box')
  important(body, 'padding-top', EPUB_CONTENT_VERTICAL_PADDING)
  important(body, 'padding-bottom', EPUB_CONTENT_VERTICAL_PADDING)
  important(body, 'padding-left', EPUB_CONTENT_HORIZONTAL_PADDING)
  important(body, 'padding-right', EPUB_CONTENT_HORIZONTAL_PADDING)
}

/** 覆盖 epub.js / 书内样式，强制左右各 5% 对称边距 */
export function applyEpubReadingLayout(doc: Document): void {
  let style = doc.getElementById(READER_LAYOUT_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = READER_LAYOUT_STYLE_ID
    doc.head.appendChild(style)
  }
  style.textContent = buildReaderLayoutCss()
  syncEpubReadingInlineStyles(doc)
}

interface EpubContentsLike {
  document?: Document
}

/** 对 rendition 内所有章节 iframe 重新应用阅读布局 */
export function applyEpubReadingLayoutToRendition(rendition: {
  getContents: () => unknown
}): void {
  const raw = rendition.getContents()
  const contentsList = (Array.isArray(raw) ? raw : raw ? [raw] : []) as EpubContentsLike[]
  for (const contents of contentsList) {
    if (contents?.document) {
      applyEpubReadingLayout(contents.document)
    }
  }
}
