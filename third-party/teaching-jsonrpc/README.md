# teaching-jsonrpc（手搓 JSON-RPC 教学快照）

> 来源 commit：`5600be7`（2026-09-21，`feat(acp)!: 淘汰Antigravity运行时，只保留Codex`）
> 快照日期：2026-09-22（UTC）
> 主从关系：**正式为主，教学为从**。正式实现见 `packages/acp/src/transport/jsonrpc-transport.ts`
> （及 `packages/acp/src/index.ts` 的传输导出）；本目录是该文件在来源 commit 时的**冻结复制**，
> 与正式已分叉，后续正式演进（含 SDK 迁移）不再同步到此。

## 禁止引用声明

- 本目录为**教学代码**：仅供阅读与显式单测，**禁止被任何正式代码 `import` / `re-export`**。
- 三无隔离，无 `package.json`、无 `workspaces` 声明、无路径别名（`tsconfig.*` / `vitest.config.ts` /
  `electron.vite.config.ts` 均未收录本目录），不进 `typecheck` / `lint:deps` / `check:bundle` /
  Vitest 默认 glob。
- 正式引用全部指向 SDK 后，主迁移收尾时确认 `packages/acp/src/index.ts` 无教学导出，
  本目录保持不动（归档只增不改）。

## 文件清单

| 文件 | 来源 | 说明 |
|------|------|------|
| `jsonrpc-transport.snapshot.ts` | `packages/acp/src/transport/jsonrpc-transport.ts` | 行分隔 JSON-RPC 2.0 stdio 传输冻结复制（仅追加头注释） |
| `jsonrpc-transport.snapshot.test.ts` | `packages/acp/src/transport/jsonrpc-transport.test.ts` | 对应用例冻结复制（仅追加头注释 + `import` 指向 `.snapshot`） |

## 显式运行法（默认 `bun run test` 不会扫到本目录）

```bash
bunx vitest run third-party/teaching-jsonrpc/
```

> 注（2026-09-22 实测）：仓库 `vitest.config.ts` 的 `include` 仅覆盖
> `apps/desktop/src` / `electron` / `scripts` / `packages`，裸跑上式会报
> `No test files found`。三无要求**禁止为此改仓库内 `vitest.config.ts`**；
> 实际验证用仓库外临时 config 显式指定
> `include: ['third-party/teaching-jsonrpc/**/*.test.ts']`，5/5 通过。

## 待补充（等主迁移完成）

- 被删协议块摘录：`acp-client.ts` 507–553（传输构造与 `initialize` 握手）、
  `client-handlers.ts` 路由对照（Agent→Client 方法表）、`session-open` 时序。
- 主迁移未完成前先只归档 transport 两份，不动正式链。
