# electron/services

主进程业务实现。IPC 只从这里调；根上文件平铺即可，不必再拆目录。ACP 已独立在 [`acp/`](./acp/)。

## 工作区与文件

| 文件 | 功能 |
|------|------|
| `file-service.ts` | 打开/保存对话框、读文本/二进制/图片、粘贴图、导出入口 |
| `workspace.ts` | 扫描工作区树（深度限制、忽略目录、去掉空文件夹） |
| `workspace-fs.ts` | 工作区内新建/重命名/移动/复制/删除 |
| `workspace-watcher.ts` | 监听工作区变更并通知渲染进程 |
| `export-save-path.ts` | 导出 HTML/PDF/Markdown 的保存路径 |

## 阅读标记与测验

| 文件 | 功能 |
|------|------|
| `reading-marks-service.ts` | 书签 / 高亮 / 批注 JSON 持久化（`userData`） |
| `quiz-service.ts` | AI 测验与答题打分记录 JSONL 追加型持久化（`userData`） |

## 应用壳

| 文件 | 功能 |
|------|------|
| `app-service.ts` | 应用版本等 |
| `app-paths.ts` | 图标等资源路径 |
| `runtime-state.ts` | 进程内开关（如 verbose 渲染日志） |
| `error-log-service.ts` | 渲染端上报错误写入日志文件 |

## ACP

见 [`acp/`](./acp/)。
