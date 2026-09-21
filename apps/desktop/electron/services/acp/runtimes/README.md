# electron/services/acp/runtimes

按 Agent 运行时划分的配置、发现、凭据桥接与认证守门员模块。

| 运行时 | 目录 | 核心职能 |
|--------|------|----------|
| `codex-acp` | `codex/` | 本机 `~/.codex/auth.json` 登录探测、自定义供应商 (API Key) 与隔离 `CODEX_HOME` 生成 |

入口：`index.ts`（`getAcpRuntimeAdapter` 统一工厂方法）。Antigravity 运行时已淘汰（目录与桥接代码已删，含硬编码凭证）。
