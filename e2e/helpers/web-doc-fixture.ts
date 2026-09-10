import path from 'node:path'
import type { Page } from '@playwright/test'

export const E2E_WEB_DOC_START_URL = 'https://e2e.inkdown.test/docs/start'
export const E2E_WEB_DOC_INSTALL_URL = 'https://e2e.inkdown.test/docs/installation'
export const E2E_WEB_DOC_XSS_URL = 'https://e2e.inkdown.test/docs/xss'

export function webDocFixtureDir(): string {
  return path.join(process.cwd(), 'e2e/fixtures/web-doc')
}

/** 欢迎页与侧栏共用同一 placeholder，必须限定主区。 */
export function welcomeWebDocUrlField(window: Page) {
  return window.locator('#main').getByPlaceholder('https://react.dev/learn')
}
