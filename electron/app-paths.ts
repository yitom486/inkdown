import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** 开发态读项目 resources/；打包后读 process.resourcesPath（electron-builder buildResources） */
export function resolveAppIconPath(): string | undefined {
  const fileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, fileName), join(process.resourcesPath, 'icon.png')]
    : [
        join(process.cwd(), 'resources', fileName),
        join(process.cwd(), 'resources', 'icon.png'),
      ]

  return candidates.find((path) => existsSync(path))
}
