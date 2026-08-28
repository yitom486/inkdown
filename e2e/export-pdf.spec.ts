import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test, expect } from '@playwright/test'
import { launchBuiltApp } from './helpers/launch-app'

test.describe('Markdown 导出 PDF', () => {
  test('通过菜单导出 PDF 并生成有效文件', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'reader-e2e-pdf-'))
    const exportPath = join(tempDir, 'export.pdf')

    const app = await launchBuiltApp({ E2E_AUTO_EXPORT_PATH: exportPath })

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      await window.getByRole('button', { name: '文件', exact: true }).click()
      await window.getByRole('menuitem', { name: '导出 PDF' }).click()

      await expect
        .poll(
          async () => {
            try {
              const buffer = await readFile(exportPath)
              return buffer.subarray(0, 5).toString() === '%PDF-'
            } catch {
              return false
            }
          },
          { timeout: 30_000, message: '等待 PDF 文件写入' },
        )
        .toBe(true)
    } finally {
      await app.close()
    }
  })
})
