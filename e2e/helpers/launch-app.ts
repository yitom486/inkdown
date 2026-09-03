import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { _electron as electron, type ElectronApplication } from '@playwright/test'

const MAIN_ENTRY = path.join(process.cwd(), 'out/main/main.js')

export async function launchBuiltApp(
  extraEnv: Record<string, string> = {},
): Promise<ElectronApplication> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkdown-e2e-'))
  const app = await electron.launch({
    args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      ...extraEnv,
    },
  })

  app.on('close', () => {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    } catch {}
  })

  return app
}
