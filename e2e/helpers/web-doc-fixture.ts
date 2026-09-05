import path from 'node:path'

export const E2E_WEB_DOC_START_URL = 'https://e2e.inkdown.test/docs/start'
export const E2E_WEB_DOC_INSTALL_URL = 'https://e2e.inkdown.test/docs/installation'
export const E2E_WEB_DOC_XSS_URL = 'https://e2e.inkdown.test/docs/xss'

export function webDocFixtureDir(): string {
  return path.join(process.cwd(), 'e2e/fixtures/web-doc')
}
