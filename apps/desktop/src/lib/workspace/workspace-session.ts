export type WorkspaceActiveSurface = 'none' | 'file' | 'web-doc'

export interface WorkspaceSessionSnapshot {
  restoreOnStartup: boolean
  activeSurface: WorkspaceActiveSurface
  lastOpenedFilePath?: string
  lastWebDocUrl?: string
}

export interface StartupRestoreTarget {
  kind: 'file' | 'web-doc'
  path: string
}

/** 根据持久化快照决定启动时应恢复哪一类主区内容（无草稿恢复时）。 */
export function resolveStartupRestoreTarget(
  snapshot: WorkspaceSessionSnapshot,
): StartupRestoreTarget | null {
  if (!snapshot.restoreOnStartup) return null

  if (snapshot.activeSurface === 'web-doc' && snapshot.lastWebDocUrl?.trim()) {
    return { kind: 'web-doc', path: snapshot.lastWebDocUrl.trim() }
  }

  if (snapshot.activeSurface === 'file' && snapshot.lastOpenedFilePath?.trim()) {
    return { kind: 'file', path: snapshot.lastOpenedFilePath.trim() }
  }

  // 兼容旧数据：仅有 lastOpenedFilePath、未记录 activeSurface
  if (snapshot.lastOpenedFilePath?.trim()) {
    return { kind: 'file', path: snapshot.lastOpenedFilePath.trim() }
  }

  return null
}
