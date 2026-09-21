/**
 * ACP 核心 UI 与会话状态门面（Facade）。
 *
 * 实际逻辑已模块化拆解至 `./acp/` 专职切片目录中：
 * - `acp/session-slice.ts`：协议连接状态、运行时、会话 ID、模型与配置偏好
 * - `acp/chat-slice.ts`：多会话线程、消息流式接收、快照标记与大纲计划提升
 * - `acp/permission-slice.ts`：工具调用权限审批拦截与同步
 * - `acp/hud-slice.ts`：伴读 HUD 面板开闭与输入框调度
 * - `acp/reader-hud-store.ts`：伴读 HUD 独立表现层（三态、自由拖拽坐标、四大 Tab、卡轨开关）
 * - `acp/acp-store.ts`：Slices 组装与持久化中间件
 *
 * 保留本文件以 100% 向后兼容既有引用与单元测试。
 */

export * from './acp'
export type { AcpChatMessage, AcpChatRole } from '@/stores/acp-chat-types'
