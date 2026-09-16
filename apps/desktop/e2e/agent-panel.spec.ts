import { test, expect } from '@playwright/test'
import { launchBuiltApp } from './helpers/launch-app'

/**
 * Agent 面板壳冒烟：不依赖真实 codex-acp。
 * 权限按钮浮现 / session resume 的深层路径由 Vitest 单元+集成覆盖。
 */
test.describe('Agent 面板壳', () => {
  test('可打开 Agent 聊天区并看到连接入口', async () => {
    const app = await launchBuiltApp()

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await expect(window.getByRole('button', { name: '文件', exact: true })).toBeVisible({
        timeout: 15_000,
      })

      const activityBar = window.getByRole('complementary', { name: '活动栏' })
      // panelOpen 可能被 persist 成已打开：两种标签都能点
      const agentToggle = activityBar
        .getByRole('button', { name: '打开 Agent 面板' })
        .or(activityBar.getByRole('button', { name: '关闭 Agent 面板' }))
      await expect(agentToggle).toBeVisible({ timeout: 10_000 })

      const panel = window.getByRole('region', { name: 'Agent 聊天' })
      if (!(await panel.isVisible().catch(() => false))) {
        await activityBar.getByRole('button', { name: '打开 Agent 面板' }).click()
      }
      await expect(panel).toBeVisible({ timeout: 10_000 })
      await expect(panel.getByText('Agent', { exact: true }).first()).toBeVisible()

      const connectOrHint = panel
        .getByRole('button', { name: '连接' })
        .or(panel.getByText(/请先打开工作区|开始与 Codex 对话|未连接/))
      await expect(connectOrHint.first()).toBeVisible({ timeout: 10_000 })
    } finally {
      await app.close()
    }
  })
})
