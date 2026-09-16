/** 本机 Bun 是否可用；ACP spawn 前探测，不含安装路径密钥 */
export interface BunRuntimeStatus {
  installed: boolean
  /** 探测到时的版本号 */
  version?: string
}
