import { useCallback, useEffect, useState } from 'react'
import type { FileTreeNode } from '@shared/file-types'

function getFileName(filePath?: string): string {
  if (!filePath) return '未命名'
  return filePath.split(/[/\\]/).pop() ?? filePath
}

export function useFileOperations() {
  const [content, setContent] = useState('')
  const [filePath, setFilePath] = useState<string>()
  const [savedContent, setSavedContent] = useState('')
  const [workspaceRoot, setWorkspaceRoot] = useState<string>()
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])

  const isDirty = content !== savedContent
  const fileName = getFileName(filePath)

  const syncTitle = useCallback((path?: string, dirty = false) => {
    window.electronAPI?.updateTitle({ filePath: path, isDirty: dirty })
  }, [])

  const loadFile = useCallback(
    (result: { filePath: string; content: string }) => {
      setFilePath(result.filePath)
      setContent(result.content)
      setSavedContent(result.content)
      syncTitle(result.filePath, false)
    },
    [syncTitle],
  )

  const openFile = useCallback(async () => {
    const result = await window.electronAPI?.openFile()
    if (!result) return
    loadFile(result)
  }, [loadFile])

  const openFolder = useCallback(async () => {
    const result = await window.electronAPI?.openFolder()
    if (!result) return
    setWorkspaceRoot(result.rootPath)
    setFileTree(result.tree)
  }, [])

  const openFileFromTree = useCallback(
    async (path: string) => {
      const result = await window.electronAPI?.readFile(path)
      if (!result) return
      loadFile(result)
    },
    [loadFile],
  )

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

  const quitApp = useCallback(() => {
    window.electronAPI?.quit()
  }, [])

  useEffect(() => {
    syncTitle(filePath, isDirty)
  }, [filePath, isDirty, syncTitle])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return

      const key = event.key.toLowerCase()
      if (key === 'o' && event.shiftKey) {
        event.preventDefault()
        void openFolder()
      } else if (key === 'o') {
        event.preventDefault()
        void openFile()
      } else if (key === 's' && event.shiftKey) {
        event.preventDefault()
        void saveFileAs()
      } else if (key === 's') {
        event.preventDefault()
        void saveFile()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openFile, openFolder, saveFile, saveFileAs])

  return {
    content,
    setContent,
    filePath,
    fileName,
    isDirty,
    workspaceRoot,
    fileTree,
    openFile,
    openFolder,
    openFileFromTree,
    saveFile,
    saveFileAs,
    quitApp,
  }
}

export type { FileTreeNode }
