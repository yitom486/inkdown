/** 主进程在 preload 初始化时同步下发的窗口上下文（sendSync，无 Promise） */
export interface WindowInit {
  /** 菜单「新建窗口」打开为 true：不恢复工作区/上次文件 */
  isFreshWindow: boolean
  /** E2E 门控：foliate 统一阅读器（仅测试进程注入，正常启动恒为 false） */
  e2eFoliateReader?: boolean
}
