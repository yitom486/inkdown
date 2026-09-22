import type { AcpAuthMethod, CodexAuthPreflight } from '@inkdown/contracts'
import type { GenericRuntimeAdapter } from '../index'
import { ensureAgyManaged, type AgyInstallOverrides } from './agy-install'

/**
 * agy 运行时适配器（managed 单文件桥 `dist/agy-acp-win-x64.exe`）。
 *
 * 语义（对齐同源参考实现，不拷贝架构）：
 * - initialize 跑 `agy models`/`agents`（10s 超时，进程级缓存）；
 * - 模型经 session/new 的 configOptions 到达，中途换模型走
 *   session/set_config_option（configId 含 model|effort|mode|agent|…），
 *   即我方现有 setModel 通道直通，无需 set_model 逃生口；
 * - authMethods 为 []（直连即可）；
 * - 历史回放刻意极简（本地 zustand 仍是显示真相源）。
 *
 * 安装（按本任务用户要求：每次连接都保证最新）：
 * - resolveSpawnCommand 内调 ensureManaged（缺失即安装/有即比对/出新即更新）；
 * - updated=true 表示本次发生了安装/更新，连接层先杀同 runtime 温进程
 *   再走冷启动（Windows 运行中 exe 无法覆盖，必须先杀）。
 */
export function probeAgyAuth(): CodexAuthPreflight {
  return {
    codexHome: '',
    hasCodexHome: false,
    hasAuthFile: false,
    hasApiKeyEnv: false,
    looksLoggedIn: false,
  }
}

export interface AgySpawnResolved {
  command: string
  args: string[]
  updated: boolean
}

export function resolveAgySpawnCommand(overrides?: AgyInstallOverrides): AgySpawnResolved {
  // 抛错即向上传导：安装失败绝不静默回退，由连接层转 ACP_SPAWN_ERROR
  const ensured = ensureAgyManaged(overrides)
  return { command: ensured.exePath, args: [], updated: ensured.updated }
}

export const agyAdapter: GenericRuntimeAdapter = {
  id: 'agy',
  probeAuth: () => probeAgyAuth(),
  resolveSpawnCommand: () => resolveAgySpawnCommand(),
  orderAuthMethods: (methods: AcpAuthMethod[]) => methods,
  canSkipInteractiveAuth: () => false,
  // authMethods 为 []，直连即可；文件探针中性，gate 侧先试直接建会话
  tryDirectSessionFirst: true,
}
