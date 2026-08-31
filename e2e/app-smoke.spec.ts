import { test, expect } from '@playwright/test'
import { launchBuiltApp } from './helpers/launch-app'

test.describe('应用启动', () => {
  test('主窗口加载并显示欢迎页与文件菜单', async () => {
    const app = await launchBuiltApp()

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await expect(window.getByRole('button', { name: '文件', exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await expect(window.getByRole('button', { name: '帮助' })).toBeVisible()
      await expect(window.getByRole('heading', { name: 'Inkdown' })).toBeVisible()
    } finally {
      await app.close()
    }
  })
})
