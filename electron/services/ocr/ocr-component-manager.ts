import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { err, ok, type Result } from '@shared/core/result'
import type { AppError } from '@shared/core/errors'
import { IPC } from '@shared/ipc/channels'
import type { OcrComponentStatus } from '@shared/types/ocr'
import {
  downloadOcrRuntime,
  isOcrRuntimeInstalled,
  loadCreateWorker,
  usesBundledDevRuntime,
} from './ocr-runtime'
import { resolveTesseractCachePath, resolveTesseractWorkerOptions } from './tesseract-config'

export const OCR_REQUIRED_LANGS = ['chi_sim', 'eng'] as const

let lastStatus: OcrComponentStatus = {
  phase: 'not-ready',
  progress: 0,
  runtimeReady: false,
  languages: [],
  missingLanguages: [...OCR_REQUIRED_LANGS],
}

let ensurePromise: Promise<Result<void, AppError>> | null = null
let cancelRequested = false
let activeDownloadWorker: { terminate: () => Promise<unknown> } | null = null

async function langPackExists(cachePath: string, lang: string): Promise<boolean> {
  try {
    await access(join(cachePath, `${lang}.traineddata`))
    return true
  } catch {
    return false
  }
}

function broadcastOcrComponentStatus(status: OcrComponentStatus): void {
  lastStatus = status
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC.OCR_COMPONENT_STATUS, status)
    }
  }
}

function buildStatusMessage(
  runtimeReady: boolean,
  missingLanguages: string[],
): string | undefined {
  if (!runtimeReady) {
    return usesBundledDevRuntime()
      ? '开发模式使用内置 OCR 运行时'
      : '需下载 OCR 运行时与语言包（约 25MB）'
  }
  if (missingLanguages.length === 0) {
    return 'OCR 组件已就绪'
  }
  if (missingLanguages.length === OCR_REQUIRED_LANGS.length) {
    return '需下载中英语言包（约 20MB）'
  }
  return `缺少语言包：${missingLanguages.join('、')}`
}

export async function inspectOcrComponentStatus(): Promise<OcrComponentStatus> {
  const runtimeReady = await isOcrRuntimeInstalled()
  const cachePath = await resolveTesseractCachePath()
  const languages: string[] = []
  const missingLanguages: string[] = []

  for (const lang of OCR_REQUIRED_LANGS) {
    if (await langPackExists(cachePath, lang)) {
      languages.push(lang)
    } else {
      missingLanguages.push(lang)
    }
  }

  const fullyReady = runtimeReady && missingLanguages.length === 0
  const status: OcrComponentStatus = {
    phase: fullyReady
      ? 'ready'
      : ensurePromise
        ? 'downloading'
        : lastStatus.phase === 'error'
          ? 'error'
          : 'not-ready',
    progress: fullyReady ? 100 : ensurePromise ? lastStatus.progress : 0,
    message: buildStatusMessage(runtimeReady, missingLanguages),
    runtimeReady,
    languages,
    missingLanguages,
  }

  lastStatus = status
  return status
}

export function getOcrComponentStatus(): OcrComponentStatus {
  return lastStatus
}

export async function ensureOcrComponent(): Promise<Result<void, AppError>> {
  const current = await inspectOcrComponentStatus()
  if (current.phase === 'ready') {
    broadcastOcrComponentStatus(current)
    return ok(undefined)
  }

  if (ensurePromise) return ensurePromise

  ensurePromise = (async (): Promise<Result<void, AppError>> => {
    cancelRequested = false

    try {
      if (!current.runtimeReady) {
        broadcastOcrComponentStatus({
          ...current,
          phase: 'downloading',
          progress: 0,
          message: '正在下载 OCR 运行时…',
        })
        await downloadOcrRuntime((message, progress) => {
          if (cancelRequested) return
          broadcastOcrComponentStatus({
            phase: 'downloading',
            progress: Math.min(40, progress),
            message,
            runtimeReady: false,
            languages: current.languages,
            missingLanguages: current.missingLanguages,
          })
        })
        if (cancelRequested) {
          return err({ code: 'CANCELLED', message: '已取消下载' })
        }
      }

      const afterRuntime = await inspectOcrComponentStatus()
      if (afterRuntime.missingLanguages.length === 0) {
        broadcastOcrComponentStatus(afterRuntime)
        return ok(undefined)
      }

      broadcastOcrComponentStatus({
        ...afterRuntime,
        phase: 'downloading',
        progress: 45,
        message: '正在下载 OCR 语言包…',
      })

      const createWorker = await loadCreateWorker()
      const options = await resolveTesseractWorkerOptions()
      const worker = await createWorker([...OCR_REQUIRED_LANGS], 1, {
        ...options,
        logger: (message) => {
          if (cancelRequested) return
          broadcastOcrComponentStatus({
            phase: 'downloading',
            progress: 45 + Math.round(message.progress * 55),
            message: message.status,
            runtimeReady: true,
            languages: afterRuntime.languages,
            missingLanguages: afterRuntime.missingLanguages,
          })
        },
      })
      activeDownloadWorker = worker

      if (cancelRequested) {
        await worker.terminate()
        activeDownloadWorker = null
        const cancelled = await inspectOcrComponentStatus()
        broadcastOcrComponentStatus(cancelled)
        return err({ code: 'CANCELLED', message: '已取消下载' })
      }

      await worker.terminate()
      activeDownloadWorker = null

      const ready = await inspectOcrComponentStatus()
      if (ready.phase !== 'ready') {
        const failed: OcrComponentStatus = {
          ...ready,
          phase: 'error',
          message: 'OCR 组件安装未完成，请重试',
        }
        broadcastOcrComponentStatus(failed)
        return err({ code: 'OCR_FAILED', message: failed.message ?? 'OCR 组件安装失败' })
      }

      broadcastOcrComponentStatus(ready)
      return ok(undefined)
    } catch (cause) {
      activeDownloadWorker = null
      const failed: OcrComponentStatus = {
        ...(await inspectOcrComponentStatus()),
        phase: 'error',
        message: cause instanceof Error ? cause.message : 'OCR 组件安装失败',
      }
      broadcastOcrComponentStatus(failed)
      return err({
        code: 'OCR_FAILED',
        message: failed.message ?? 'OCR 组件安装失败',
      })
    }
  })().finally(() => {
    ensurePromise = null
  })

  return await ensurePromise
}

export async function cancelOcrComponentDownload(): Promise<OcrComponentStatus> {
  cancelRequested = true
  if (activeDownloadWorker) {
    await activeDownloadWorker.terminate()
    activeDownloadWorker = null
  }
  const status = await inspectOcrComponentStatus()
  broadcastOcrComponentStatus(status)
  return status
}
