export const queryKeys = {
  appMeta: ['app', 'meta'] as const,
  workspace: ['workspace'] as const,
  readBinary: (filePath: string) => ['read-binary', filePath] as const,
  readingMarks: (filePath: string) => ['reading-marks', filePath] as const,
  webDocPage: (pageUrl: string) => ['web-doc-page', pageUrl] as const,
  webDocToc: (discoveryUrl: string) => ['web-doc-toc', discoveryUrl] as const,
}
