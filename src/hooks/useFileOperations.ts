import { useCallback, useEffect, useState } from 'react'

function getFileName(filePath?: string): string {
  if (!filePath) return '未命名'
  return filePath.split(/[/\\]/).pop() ?? filePath
}

export function useFileOperations() {
  const [content, setContent] = useState('')
  const [filePath, setFilePath] = useState<string>()
  const [savedContent, setSavedContent] = useState('')

  const isDirty = content !== savedContent
  const fileName = getFileName(filePath)

  const syncTitle = useCallback(
    (path?: string, dirty = false) => {
      window.electronAPI?.updateTitle({ filePath: path, isDirty: dirty })
    },
    [],
  )

  const openFile = useCallback(async () => {
    const result = await window.electronAPI?.openFile()
    if (!result) return

    setFilePath(result.filePath)
    setContent(result.content)
    setSavedContent(result.content)
    syncTitle(result.filePath, false)
  }, [syncTitle])

  const saveFile = useCallback(async () => {
    const result = await window.electronAPI?.saveFile({
      filePath,
      content,
    })
    if (!result) return

    setFilePath(result.filePath)
    setSavedContent(content)
    syncTitle(result.filePath, false)
  }, [content, filePath, syncTitle])

  const saveFileAs = useCallback(async () => {
    const result = await window.electronAPI?.saveFileAs({ content })
    if (!result) return

    setFilePath(result.filePath)
    setSavedContent(content)
    syncTitle(result.filePath, false)
  }, [content, syncTitle])

  useEffect(() => {
    syncTitle(filePath, isDirty)
  }, [filePath, isDirty, syncTitle])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    const cleanups = [
      api.onMenuOpen(() => void openFile()),
      api.onMenuSave(() => void saveFile()),
      api.onMenuSaveAs(() => void saveFileAs()),
    ]

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [openFile, saveFile, saveFileAs])

  return {
    content,
    setContent,
    filePath,
    fileName,
    isDirty,
    openFile,
    saveFile,
    saveFileAs,
  }
}
