import path from 'node:path'
import { _electron as electron, type ElectronApplication } from '@playwright/test'

const MAIN_ENTRY = path.join(process.cwd(), 'out/main/main.js')

export async function launchBuiltApp(
  extraEnv: Record<string, string> = {},
): Promise<ElectronApplication> {
  return electron.launch({
    args: [MAIN_ENTRY],
    env: {
      ...process.env,
      ...extraEnv,
    },
  })
}
