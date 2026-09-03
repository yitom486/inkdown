# src/api

渲染端 **IPC 客户端**。组件 / Hook **禁止**直接调 `window.electronAPI` 的文件类 API；一律走这里。

有返回值的调用对应主进程 `Result<T, AppError>`；用户取消为 `CANCELLED`（一般不弹错误）。

| 文件 | 功能 |
|------|------|
| `file-api.ts` | 打开/保存/读写文件、工作区、导出、粘贴图等 |
| `app-api.ts` | 应用级：关于、日志开关等 |
| `acp-api.ts` | ACP Agent：连接、prompt、权限、配置 |
| `reading-marks-api.ts` | 书签 / 高亮 / 批注 CRUD |
| `quiz-api.ts` | AI 测验与答题打分记录持久化（JSONL） |
| `web-doc-api.ts` | 在线文档：抓取页面、发现目录 |
| `query-keys.ts` | TanStack Query key 工厂 |

新增能力顺序（见 AGENTS.md）：`shared` → `electron/services` → IPC 注册 → preload → **本目录** → hooks。
