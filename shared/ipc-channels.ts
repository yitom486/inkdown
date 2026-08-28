export const IPC = {
  APP_GET_VERSION: 'app:get-version',
  APP_QUIT: 'app:quit',
  APP_SET_DIRTY: 'app:set-dirty',
  APP_REQUEST_CLOSE: 'app:request-close',
  APP_CLOSE_DECISION: 'app:close-decision',
  FILE_OPEN: 'file:open',
  FILE_OPEN_FOLDER: 'file:open-folder',
  FILE_READ: 'file:read',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  FILE_UPDATE_TITLE: 'file:update-title',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
