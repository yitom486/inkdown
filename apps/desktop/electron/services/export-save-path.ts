import { dialog, type SaveDialogOptions } from 'electron'

/**
 * 解析导出保存路径。E2E 测试时通过环境变量 `E2E_AUTO_EXPORT_PATH` 跳过原生对话框。
 * 该变量仅由 Playwright 测试进程注入，正常启动不会设置。
 */
export async function resolveExportSavePath(
  options: SaveDialogOptions,
): Promise<{ canceled: boolean; filePath?: string }> {
  const e2ePath = process.env.E2E_AUTO_EXPORT_PATH?.trim()
  if (e2ePath) {
    return { canceled: false, filePath: e2ePath }
  }

  return dialog.showSaveDialog(options)
}
