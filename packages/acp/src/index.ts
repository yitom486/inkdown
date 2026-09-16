/**
 * @inkdown/acp barrel（E片合并）。
 *
 * 11 模块，按传输 / 认证 / 会话 / MCP 分组。session-open 留守 electron，
 * 不在此导出（见 electron/services/acp/session-open.ts）。
 *
 * 查重（A/B 片 export 清单）：
 * - registry 的 listAcpRuntimes / getAcpRuntime / getDefaultAcpRuntime 全库唯一，
 *   无 list/get/getDefault 裸名冲突；
 * - MCP 三表仅共享类型名 InkdownMcpToolContext/Definition（同源自
 *   inkdown-mcp-tools），接口声明一致，无值冲突；
 * - 其余 11 模块导出名两两不交，可安全 `export *`，无需显式冲突消解。
 * 若后续新增裸名 list/get 等，须在此改显式重导出并报告。
 */

// ── 传输 ──
export * from "./jsonrpc-transport";
export * from "./terminal-output-buffer";

// ── 认证 ──
export * from "./auth-method-order";
export * from "./connect-auth-decision";
export * from "./connect-auth-gate";

// ── 会话 ──
export * from "./agent-registry";
export * from "./config-options";
export * from "./session-capabilities";

// ── MCP ──
export * from "./inkdown-mcp-tools";
export * from "./inkdown-mcp-toc-tools";
export * from "./inkdown-mcp-rpc";
