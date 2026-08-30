export const HIGHLIGHT_COLORS = [
  {
    id: 'yellow',
    label: '黄',
    swatch: '#facc15',
    light: 'rgba(250, 204, 21, 0.38)',
    dark: 'rgba(253, 224, 71, 0.26)',
  },
  {
    id: 'green',
    label: '绿',
    swatch: '#4ade80',
    light: 'rgba(74, 222, 128, 0.34)',
    dark: 'rgba(74, 222, 128, 0.24)',
  },
  {
    id: 'blue',
    label: '蓝',
    swatch: '#60a5fa',
    light: 'rgba(96, 165, 250, 0.32)',
    dark: 'rgba(147, 197, 253, 0.24)',
  },
  {
    id: 'pink',
    label: '粉',
    swatch: '#f472b6',
    light: 'rgba(244, 114, 182, 0.32)',
    dark: 'rgba(244, 114, 182, 0.24)',
  },
  {
    id: 'orange',
    label: '橙',
    swatch: '#fb923c',
    light: 'rgba(251, 146, 60, 0.34)',
    dark: 'rgba(253, 186, 116, 0.24)',
  },
] as const

export type HighlightColorId = (typeof HIGHLIGHT_COLORS)[number]['id']

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColorId = 'yellow'

/** 划选时的系统选区底色：半透明黄，不改文字色 */
export const LIVE_SELECTION_BACKGROUND = 'rgba(250, 204, 21, 0.32)'

const COLOR_IDS = new Set<string>(HIGHLIGHT_COLORS.map((item) => item.id))

export function isHighlightColorId(value: string | undefined): value is HighlightColorId {
  return Boolean(value && COLOR_IDS.has(value))
}

export function normalizeHighlightColor(color?: string): HighlightColorId {
  return isHighlightColorId(color) ? color : DEFAULT_HIGHLIGHT_COLOR
}

export function highlightSwatch(color?: string): string {
  const id = normalizeHighlightColor(color)
  return HIGHLIGHT_COLORS.find((item) => item.id === id)!.swatch
}

export function highlightFill(color: string | undefined, theme: 'dark' | 'light'): string {
  const id = normalizeHighlightColor(color)
  const entry = HIGHLIGHT_COLORS.find((item) => item.id === id)!
  return theme === 'dark' ? entry.dark : entry.light
}

export function applyHighlightSurface(
  element: HTMLElement,
  color: string | undefined,
  theme: 'dark' | 'light',
): void {
  const id = normalizeHighlightColor(color)
  element.dataset.color = id
  element.style.setProperty('background', highlightFill(id, theme), 'important')
}

export function liveSelectionCss(): string {
  return `
    ::selection {
      background-color: ${LIVE_SELECTION_BACKGROUND} !important;
      color: inherit !important;
    }
    ::-moz-selection {
      background-color: ${LIVE_SELECTION_BACKGROUND} !important;
      color: inherit !important;
    }
  `
}
