import { app } from 'electron'
import { toAppError, type AppError } from '@shared/errors'
import { err, ok, type Result } from '@shared/result'

export function getAppVersion(): Result<string, AppError> {
  try {
    const version = app.getVersion()
    if (!version.trim()) {
      return err({ code: 'UNKNOWN', message: '无法读取应用版本' })
    }
    return ok(version)
  } catch (error) {
    return err(toAppError(error, '获取版本信息失败'))
  }
}
