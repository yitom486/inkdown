import { Menu } from 'electron'

/**
 * 隐藏菜单栏时仍需 Edit 角色加速键；`Menu.setApplicationMenu(null)` /
 * `win.setMenu(null)` 会导致 Windows 上 Ctrl+C/V 等失效。
 */
export function installAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            role: 'appMenu' as const,
          },
        ]
      : []),
    { role: 'editMenu' },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    ...(isMac
      ? [
          {
            role: 'windowMenu' as const,
          },
        ]
      : [
          {
            label: '窗口',
            submenu: [{ role: 'minimize' as const }, { role: 'close' as const }],
          },
        ]),
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
