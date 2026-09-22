# electron/services/acp/runtimes

按 Agent 运行时划分的配置、发现、凭据桥接与认证守门员模块。

| 运行时 | 目录 | 核心职能 |
|--------|------|----------|
| `codex-acp` | `codex/` | 本机 `~/.codex/auth.json` 登录探测、自定义供应商 (API Key) 与隔离 `CODEX_HOME` 生成 |
| `claude` | `claude/` | 本机 Claude Code 登录（`~/.claude.json`）/`ANTHROPIC_API_KEY` 探测 |
| `gemini` | `gemini/` | Gemini CLI 登录（`~/.gemini/oauth_creds.json`）/`GEMINI_API_KEY` 探测 |
| `copilot` | `copilot/` | Copilot CLI 登录（`~/.copilot/config.json` 的 `loggedInUsers`，`COPILOT_HOME` 可改目录）/ `GH_TOKEN` 系探测 |
| `opencode` | `opencode/` | `opencode auth login` 的 auth.json（legacy；`$XDG_DATA_HOME/opencode/` 优先，win `%LOCALAPPDATA%\\opencode\\` ＞ `%USERPROFILE%\\.local\\share\\opencode\\`；空白/非法/空对象判未登录）探测 |
| `cursor-cli` | `cursor/` | 安装路径探测（`resolveCursorCommand`：win `%LOCALAPPDATA%\\cursor-agent\\agent.cmd` / posix `~/.local/bin/agent` / 回落 PATH）+ 预 spawn 接线（`resolveSpawnCommand`：两处皆无回 `null`，由 `acp-connection.ts` 转带安装指引的 `ACP_SPAWN_ERROR`）；登录态文件位置官方未承诺，保守仅认 `CURSOR_API_KEY` |
| `deepseek` | `deepseek/` | `DEEPSEEK_API_KEY` 探测（harness 自身 `authMethods` 为空，天然跳过认证） |

新适配器一律实现 `GenericRuntimeAdapter`：`probeAuth` 按各家凭证位置、
`orderAuthMethods` 默认透传、`canSkipInteractiveAuth` 保守 `false`；需预检 CLI
安装时可选实现 `resolveSpawnCommand`（`null` = 未安装，由连接层转错）；
代理 `getSpawnEnv` 未声明时由 `acp-client.ts` 回落通用 `buildAcpProxySpawnEnv`，
故各适配器按需省略。`codex/` 另有 `getCustomProvider`（隔离 `CODEX_HOME`），他家不跟进。

入口：`index.ts`（`getAcpRuntimeAdapter` 统一工厂方法，未知 id 回落空壳中性探测）。Antigravity 运行时已淘汰（目录与桥接代码已删，含硬编码凭证）。
