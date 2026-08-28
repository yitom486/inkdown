import { dialog, BrowserWindow } from 'electron'
import { dirname, extname, join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import {
  DEFAULT_SAVE_FILENAME,
  HTML_DIALOG_FILTERS,
  MARKDOWN_DIALOG_FILTERS,
  PASTED_IMAGE_ASSETS_DIR,
  PDF_DIALOG_FILTERS,
} from '@shared/constants'
import { IMAGE_EXTENSION_BY_MIME, IMAGE_MIME_BY_EXTENSION } from '@shared/image-constants'
import { toAppError, type AppError } from '@shared/errors'
import { err, ok, type Result } from '@shared/result'
import type {
  ExportDocumentPayload,
  ExportDocumentResult,
  OpenFileResult,
  OpenFolderResult,
  ReadImageResult,
  SaveFilePayload,
  SaveFileResult,
  SavePastedImagePayload,
  SavePastedImageResult,
} from '@shared/file-types'
import { scanWorkspace } from './workspace'

const markdownFilters = MARKDOWN_DIALOG_FILTERS

export async function openFileDialog(): Promise<Result<OpenFileResult, AppError>> {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '打开 Markdown 文件',
      filters: markdownFilters,
      properties: ['openFile'],
    })

    if (canceled || filePaths.length === 0) {
      return err({ code: 'CANCELLED', message: '已取消打开文件' })
    }

    const filePath = filePaths[0]!
    const content = await readFile(filePath, 'utf-8')
    return ok({ filePath, content })
  } catch (error) {
    return err(toAppError(error, '打开文件失败'))
  }
}

export async function openFolderDialog(): Promise<Result<OpenFolderResult, AppError>> {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '打开文件夹',
      properties: ['openDirectory'],
    })

    if (canceled || filePaths.length === 0) {
      return err({ code: 'CANCELLED', message: '已取消打开文件夹' })
    }

    const rootPath = filePaths[0]!
    const tree = await scanWorkspace(rootPath)
    return ok({ rootPath, tree })
  } catch (error) {
    return err(toAppError(error, '打开文件夹失败'))
  }
}

export async function readFileByPath(
  filePath: string,
): Promise<Result<OpenFileResult, AppError>> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return ok({ filePath, content })
  } catch (error) {
    return err(toAppError(error, '读取文件失败'))
  }
}

export async function readImageAsDataUrl(
  filePath: string,
): Promise<Result<ReadImageResult, AppError>> {
  try {
    const mime = IMAGE_MIME_BY_EXTENSION[extname(filePath).toLowerCase()]
    if (!mime) {
      return err({
        code: 'FILE_READ_ERROR',
        message: '不支持的图片格式',
      })
    }

    const buffer = await readFile(filePath)
    return ok({
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
    })
  } catch (error) {
    return err(toAppError(error, '读取图片失败'))
  }
}

export async function saveFileDialog(
  payload: SaveFilePayload,
): Promise<Result<SaveFileResult, AppError>> {
  try {
    let filePath = payload.filePath

    if (!filePath) {
      const { canceled, filePath: selectedPath } = await dialog.showSaveDialog({
        title: '保存 Markdown 文件',
        filters: markdownFilters,
        defaultPath: DEFAULT_SAVE_FILENAME,
      })

      if (canceled || !selectedPath) {
        return err({ code: 'CANCELLED', message: '已取消保存文件' })
      }

      filePath = selectedPath
    }

    await writeFile(filePath, payload.content, 'utf-8')
    return ok({ filePath })
  } catch (error) {
    return err(toAppError(error, '保存文件失败'))
  }
}

export async function savePastedImage(
  payload: SavePastedImagePayload,
): Promise<Result<SavePastedImageResult, AppError>> {
  try {
    const extension = IMAGE_EXTENSION_BY_MIME[payload.mimeType]
    if (!extension) {
      return err({ code: 'FILE_WRITE_ERROR', message: '不支持的图片格式' })
    }

    const assetsDir = join(dirname(payload.markdownFilePath), PASTED_IMAGE_ASSETS_DIR)
    await mkdir(assetsDir, { recursive: true })

    const fileName = `pasted-${Date.now()}${extension}`
    const absolutePath = join(assetsDir, fileName)
    await writeFile(absolutePath, Buffer.from(payload.base64, 'base64'))

    return ok({
      relativePath: `./${PASTED_IMAGE_ASSETS_DIR}/${fileName}`.replace(/\\/g, '/'),
    })
  } catch (error) {
    return err(toAppError(error, '保存粘贴图片失败'))
  }
}

export async function exportHtmlDocument(
  payload: ExportDocumentPayload,
): Promise<Result<ExportDocumentResult, AppError>> {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 HTML',
      filters: HTML_DIALOG_FILTERS,
      defaultPath: payload.suggestedName ?? 'export.html',
    })

    if (canceled || !filePath) {
      return err({ code: 'CANCELLED', message: '已取消导出 HTML' })
    }

    await writeFile(filePath, payload.html, 'utf-8')
    return ok({ filePath })
  } catch (error) {
    return err(toAppError(error, '导出 HTML 失败'))
  }
}

export async function exportPdfDocument(
  payload: ExportDocumentPayload,
): Promise<Result<ExportDocumentResult, AppError>> {
  let exportWindow: BrowserWindow | null = null

  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 PDF',
      filters: PDF_DIALOG_FILTERS,
      defaultPath: payload.suggestedName ?? 'export.pdf',
    })

    if (canceled || !filePath) {
      return err({ code: 'CANCELLED', message: '已取消导出 PDF' })
    }

    exportWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`
    await exportWindow.loadURL(dataUrl)

    const pdfBuffer = await exportWindow.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    })

    await writeFile(filePath, pdfBuffer)
    return ok({ filePath })
  } catch (error) {
    return err(toAppError(error, '导出 PDF 失败'))
  } finally {
    exportWindow?.destroy()
  }
}
