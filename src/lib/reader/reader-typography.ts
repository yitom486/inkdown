export const READER_FONT_SIZE_OPTIONS = [16, 18, 20, 22, 24] as const
export type ReaderFontSize = (typeof READER_FONT_SIZE_OPTIONS)[number]

export const READER_LINE_HEIGHT_OPTIONS = [1.5, 1.65, 1.85, 2.05] as const
export type ReaderLineHeight = (typeof READER_LINE_HEIGHT_OPTIONS)[number]

export interface ReaderTypography {
  fontSize: ReaderFontSize
  lineHeight: ReaderLineHeight
}

export const DEFAULT_READER_TYPOGRAPHY: ReaderTypography = {
  fontSize: 18,
  lineHeight: 1.85,
}

export const READER_FONT_SIZE_OPTION_LABELS = READER_FONT_SIZE_OPTIONS.map((value) => ({
  value,
  label: `${value}px`,
}))

export const READER_LINE_HEIGHT_OPTION_LABELS = READER_LINE_HEIGHT_OPTIONS.map((value) => ({
  value,
  label: String(value),
}))
