# electron/services/acp

ACP Agent 主进程侧 wiring：拉起 `codex-acp`、连接生命周期、权限/回调路由、会话开启、fs/终端、进程内 MCP 挂载。
纯逻辑已迁 `packages/acp/src/`（`@inkdown/acp`）；渲染端零直接引用（`tsconfig.web` include 已剔除 acp）。
渲染端入口：`apps/desktop/src/api/acp-api.ts` + `AgentPanel`。设计备忘见本地 `.plan/`（若不在仓库中）。

| 组 | 文件 | 功能 |
|----|------|------|
| 入口 | `acp-client.ts` / `process-manager.ts` 留守；`@inkdown/acp` 的 `packages/acp/src/transport/jsonrpc-transport.ts` 已迁 | 连接生命周期、子进程、stdio JSON-RPC；同 runtime 温进程常驻复用（断开保温、退出树杀），冷启动前清扫 `_MEI`/`.tmp` 残留（`antigravity-temp-sweep.ts`） |
| cwd | `agent-sandbox-cwd.ts` | 无用户工作区时 ACP 沙箱 cwd（`userData/agent-sandbox`） |
| 注册 | `@inkdown/acp`：`packages/acp/src/session/agent-registry.ts` | 可用运行时（默认 `codex-acp`） |
| 运行时 | `runtimes/`（`antigravity/`、`codex/`） | Codex 自定义供应商/隔离与 Antigravity 自动凭据桥接（Windows Credential Manager）、服务发现、专享代理及认证守门员 |
| 认证 | `codex-auth-preflight.ts` 留守（实现已归拢至 `runtimes/codex/`；类型单一源 `@inkdown/contracts`）；`packages/acp/src/auth/` 已迁 `@inkdown/acp` | 连接前探活、authMethods 顺序、`~/.codex` |
| 发现 | `antigravity-discovery.ts`（实现已归拢至 `runtimes/antigravity/`） | Google Antigravity 二进制（`agy_acp_server`）多级路径发现与本机凭证探测（Zed 缓存 / App 缓存 / PATH） |
| 代理 | `acp-proxy-service.ts` | Agent 子进程代理设置（userData 下 `agent/proxy` JSON 持久化）：spawn 注入 HTTP(S)_PROXY / ALL_PROXY，关闭时清理代理键 |
| 会话 | `session-open.ts` 留守；`packages/acp/src/session/session-capabilities.ts` / `packages/acp/src/session/config-options.ts` 已迁 `@inkdown/acp` | `session/new`、能力、Mode/Model |
| 回调 | `client-handlers.ts` 留守（含 `createAcpClientMethodRouter`） | Agent → 客户端：权限、fs、终端等 |
| IO | `acp-fs.ts` / `acp-terminal.ts` 留守；`packages/acp/src/transport/terminal-output-buffer.ts` 已迁 `@inkdown/acp` | 虚拟/真实读文件、终端（虚拟文件定义见 `@inkdown/contracts`：`packages/contracts/src/agent/inkdown-virtual-fs.ts`，快照类型同目录 `packages/contracts/src/agent/inkdown-snapshot.ts`） |
| MCP | `mcp/inkdown-mcp-server.ts` 留守（HTTP 挂载）；工具表与 RPC 已迁 `@inkdown/acp` | 进程内 HTTP MCP（`inkdown_*` 工具）；随连接起停 |

`mcp/` 仅留传输挂载，不必再单独维护一份长 README；工具列表以 `@inkdown/acp`（`packages/acp/src/mcp/inkdown-mcp-tools.ts`，含 RPC `packages/acp/src/mcp/inkdown-mcp-rpc.ts`）与 Skill 为准；目录副会话专用表见 `@inkdown/acp`（`packages/acp/src/mcp/inkdown-mcp-toc-tools.ts`，`toc_*`，独立端点，仅 `toolScope: 'toc'` 的会话挂载）。

标记提议模型 `mark-proposal`（单条·批量）与章级建议 `chapter-mark-plan` 已归 `@inkdown/annotations`（与渲染 `ChapterMarkPlanCard` / `ProposeMarkCard` 对接），不在本包。
