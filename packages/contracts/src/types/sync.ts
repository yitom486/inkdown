export type SyncProviderType = 'jianguoyun' | 'nextcloud' | 'custom'

export interface SyncConfig {
  enabled: boolean
  provider: SyncProviderType
  serverUrl: string
  username: string
  password: string
  remoteDir: string
  syncOnStartup: boolean
  ignoreTlsErrors?: boolean
}

export type SyncStatusPhase = 'idle' | 'syncing' | 'success' | 'error'

export interface SyncStats {
  marksAdded: number
  marksUpdated: number
  progressUpdated: number
  quizAdded: number
}

export interface SyncStatus {
  phase: SyncStatusPhase
  lastSyncTime?: number
  message?: string
  error?: string
  stats?: SyncStats
}

export interface TestConnectionResult {
  ok: boolean
  latencyMs: number
  remoteDir: string
  message?: string
}

export interface SyncExecuteResult {
  success: boolean
  timestamp: number
  stats: SyncStats
}
