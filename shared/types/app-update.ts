/** electron-updater 阶段；UI 用 phase 收窄，不要靠多个布尔 */
export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdateStatus {
  phase: AppUpdatePhase
  /** 当前已安装版本 */
  currentVersion?: string
  /** 远端新版本号 */
  version?: string
  releaseNotes?: string
  /** 下载进度 0–100 */
  percent?: number
  message?: string
}
