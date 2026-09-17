/**
 * @inkdown/acp barrel（E片合并）。
 *
 * 12 模块，按四个子目录分组：transport/（传输）、auth/（认证）、
 * session/（会话）、mcp/（MCP 工具表）。session-open 留守 electron，
 * 不在此导出（见 electron/services/acp/session-open.ts）。
 *
 * 查重（A/B 片 export 清单）：
 * - registry 的 listAcpRuntimes / getAcpRuntime / getDefaultAcpRuntime 全库唯一，
 *   无 list/get/getDefault 裸名冲突；
 * - MCP 三表仅共享类型名 InkdownMcpToolContext/Definition（同源自
 *   inkdown-mcp-tools），接口声明一致，无值冲突；
 * - 其余模块导出名两两不交，可安全 `export *`，无需显式冲突消解。
 * 若后续新增裸名 list/get 等，须在此改显式重导出并报告。
 */

// ── 传输 ──
export * from "./transport/jsonrpc-transport";
export * from "./transport/terminal-output-buffer";

// ── 认证 ──
export * from "./auth/auth-method-order";
export * from "./auth/connect-auth-decision";
export * from "./auth/connect-auth-gate";
export * from "./auth/codex-provider-home";

// ── 会话 ──
export * from "./session/agent-registry";
export * from "./session/config-options";
export * from "./session/session-capabilities";

// ── MCP ──
export * from "./mcp/inkdown-mcp-tools";
export * from "./mcp/inkdown-mcp-toc-tools";
export * from "./mcp/inkdown-mcp-rpc";
