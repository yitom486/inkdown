import { test, expect } from '@playwright/test'
import { launchBuiltApp } from './helpers/launch-app'
import {
  E2E_WEB_DOC_INSTALL_URL,
  E2E_WEB_DOC_START_URL,
  webDocFixtureDir,
} from './helpers/web-doc-fixture'

function webDocFrame(window: Awaited<ReturnType<Awaited<ReturnType<typeof launchBuiltApp>>['firstWindow']>>) {
  return window.frameLocator('.web-doc-viewer-host iframe')
}

function mainPanel(window: Awaited<ReturnType<Awaited<ReturnType<typeof launchBuiltApp>>['firstWindow']>>) {
  return window.locator('#main')
}

test.describe('在线文档阅读', () => {
  test('欢迎页打开 fixture 文档并显示正文', async () => {
    const app = await launchBuiltApp({ E2E_WEB_DOC_FIXTURE_DIR: webDocFixtureDir() })

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      await window.getByPlaceholder('https://react.dev/learn').fill(E2E_WEB_DOC_START_URL)
      await window.getByPlaceholder('https://react.dev/learn').press('Enter')

      // 侧栏 / 主区 / Agent 横幅都可能含「在线文档」，须限定主区且 exact
      const panel = mainPanel(window)
      await expect(panel.getByText('在线文档', { exact: true })).toBeVisible({ timeout: 15_000 })
      await expect(panel.locator('input[placeholder="https://"]')).toHaveValue(E2E_WEB_DOC_START_URL)

      const frame = webDocFrame(window)
      await expect(frame.getByRole('heading', { name: 'Quick Start' })).toBeVisible({ timeout: 15_000 })
      await expect(frame.getByText('Inkdown E2E fixture paragraph for online document smoke tests.')).toBeVisible()
      await expect(frame.getByRole('button', { name: '复制代码' })).toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('地址栏可切换到 fixture 第二页', async () => {
    const app = await launchBuiltApp({ E2E_WEB_DOC_FIXTURE_DIR: webDocFixtureDir() })

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      await window.getByPlaceholder('https://react.dev/learn').fill(E2E_WEB_DOC_START_URL)
      await window.getByPlaceholder('https://react.dev/learn').press('Enter')

      const addressBar = window.locator('input[placeholder="https://"]')
      await expect(addressBar).toBeVisible({ timeout: 15_000 })
      await addressBar.fill(E2E_WEB_DOC_INSTALL_URL)
      await window.getByRole('button', { name: '前往', exact: true }).click()

      const frame = webDocFrame(window)
      await expect(frame.getByRole('heading', { name: 'Installation' })).toBeVisible({ timeout: 15_000 })
      await expect(frame.getByText('Inkdown E2E fixture second page content.')).toBeVisible()
    } finally {
      await app.close()
    }
  })

  test('fixture 文档可打开目录并步进', async () => {
    const app = await launchBuiltApp({ E2E_WEB_DOC_FIXTURE_DIR: webDocFixtureDir() })

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      await window.getByPlaceholder('https://react.dev/learn').fill(E2E_WEB_DOC_START_URL)
      await window.getByPlaceholder('https://react.dev/learn').press('Enter')

      const panel = mainPanel(window)
      const tocButton = panel.getByRole('button', { name: '目录' })
      await expect(tocButton).toBeEnabled({ timeout: 15_000 })
      await tocButton.click()
      await expect(panel.getByRole('button', { name: 'Installation guide' })).toBeVisible({
        timeout: 10_000,
      })

      await panel.getByRole('button', { name: 'Installation guide' }).click()

      const frame = webDocFrame(window)
      await expect(frame.getByRole('heading', { name: 'Installation' })).toBeVisible({ timeout: 15_000 })
    } finally {
      await app.close()
    }
  })
})
