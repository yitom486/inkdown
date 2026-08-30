# electron/services/acp

ACP Agent 主进程侧：拉起 `codex-acp`、JSON-RPC、权限、会话、进程内 MCP。  
渲染端入口：`src/api/acp-api.ts` + `AgentPanel`。设计备忘见本地 `.plan/`（若不在仓库中）。

| 组 | 文件 | 功能 |
|----|------|------|
| 入口 | `acp-client.ts` / `process-manager.ts` / `jsonrpc-transport.ts` | 连接生命周期、子进程、stdio JSON-RPC |
| 注册 | `agent-registry.ts` | 可用运行时（默认 `codex-acp`） |
| 认证 | `connect-auth-gate.ts` / `connect-auth-decision.ts` / `codex-auth-preflight.ts` / `auth-method-order.ts` | 连接前探活、authMethods 顺序、`~/.codex` |
| 会话 | `session-open.ts` / `session-capabilities.ts` / `config-options.ts` | `session/new`、能力、Mode/Model |
| 回调 | `client-handlers.ts` | Agent → 客户端：权限、fs、终端等 |
| IO | `acp-fs.ts` / `acp-terminal.ts` / `terminal-output-buffer.ts` | 虚拟/真实读文件、终端 |
| MCP | `mcp/` | 进程内 HTTP MCP（`inkdown_*` 工具）；随连接起停 |

`mcp/` 为传输与工具表实现，不必再单独维护一份长 README；工具列表以 `mcp/inkdown-mcp-tools.ts` 与 Skill 为准。
