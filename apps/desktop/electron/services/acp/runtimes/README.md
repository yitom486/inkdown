# electron/services/acp/runtimes

按 Agent 运行时划分的配置、发现、凭据桥接与认证守门员模块。

| 运行时 | 目录 | 核心职能 |
|--------|------|----------|
| `antigravity-acp` | `antigravity/` | 官方 `agy_acp_server` 二进制多级发现、Windows 凭据管理器 `gemini:antigravity` 自动桥接（Auto-Bridge）、专享 SOCKS5/HTTP 代理注入、认证守门员 |
| `codex-acp` | `codex/` | 本机 `~/.codex/auth.json` 登录探测、自定义供应商 (API Key) 与隔离 `CODEX_HOME` 生成 |

入口：`index.ts`（`getAcpRuntimeAdapter` 统一工厂方法）。
