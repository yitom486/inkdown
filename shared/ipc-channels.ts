export const IPC = {
  APP_GET_VERSION: 'app:get-version',
  APP_SHOW_ABOUT: 'app:show-about',
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  FILE_MENU_OPEN: 'file:menu-open',
  FILE_MENU_SAVE: 'file:menu-save',
  FILE_MENU_SAVE_AS: 'file:menu-save-as',
  FILE_UPDATE_TITLE: 'file:update-title',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
