export const queryKeys = {
  appMeta: ['app', 'meta'] as const,
  workspace: ['workspace'] as const,
  readBinary: (filePath: string) => ['read-binary', filePath] as const,
}
