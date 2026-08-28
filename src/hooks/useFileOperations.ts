import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appApi, fileApi } from '@/api/file-api'
import { queryKeys } from '@/api/query-keys'
import { isCancelled, type AppError } from '@shared/errors'
import type { FileTreeNode, OpenFolderResult } from '@shared/file-types'
import { isOk } from '@shared/result'

function getFileName(filePath?: string): string {
  if (!filePath) return '未命名'
  return filePath.split(/[/\\]/).pop() ?? filePath
}

export function useFileOperations(onError?: (error: AppError) => void) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [filePath, setFilePath] = useState<string>()
  const [savedContent, setSavedContent] = useState('')

  const isDirty = content !== savedContent
  const fileName = getFileName(filePath)

  const { data: workspace = null } = useQuery<OpenFolderResult | null>({
    queryKey: queryKeys.workspace,
    queryFn: async () => null,
    enabled: false,
    initialData: null,
  })

  const reportError = useCallback(
    (error: AppError) => {
      if (!isCancelled(error)) {
        onError?.(error)
      }
    },
    [onError],
  )

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

  const openFileMutation = useMutation({
    mutationFn: () => fileApi.openFile(),
    onSuccess: (result) => {
      if (!isOk(result)) {
        reportError(result.error)
        return
      }
      loadFile(result.value)
    },
  })

  const openFolderMutation = useMutation({
    mutationFn: () => fileApi.openFolder(),
    onSuccess: (result) => {
      if (!isOk(result)) {
        reportError(result.error)
        return
      }
      queryClient.setQueryData(queryKeys.workspace, result.value)
    },
  })

  const readFileMutation = useMutation({
    mutationFn: (path: string) => fileApi.readFile(path),
    onSuccess: (result) => {
      if (!isOk(result)) {
        reportError(result.error)
        return
      }
      loadFile(result.value)
    },
  })

  const saveFileMutation = useMutation({
    mutationFn: (payload: { filePath?: string; content: string }) => fileApi.saveFile(payload),
    onSuccess: (result, variables) => {
      if (!isOk(result)) {
        reportError(result.error)
        return
      }
      setFilePath(result.value.filePath)
      setSavedContent(variables.content)
      syncTitle(result.value.filePath, false)
    },
  })

  const saveFileAsMutation = useMutation({
    mutationFn: (payload: { content: string }) => fileApi.saveFileAs(payload),
    onSuccess: (result, variables) => {
      if (!isOk(result)) {
        reportError(result.error)
        return
      }
      setFilePath(result.value.filePath)
      setSavedContent(variables.content)
      syncTitle(result.value.filePath, false)
    },
  })

  const openFile = useCallback(() => openFileMutation.mutateAsync(), [openFileMutation])
  const openFolder = useCallback(() => openFolderMutation.mutateAsync(), [openFolderMutation])
  const openFileFromTree = useCallback(
    (path: string) => readFileMutation.mutateAsync(path),
    [readFileMutation],
  )
  const saveFile = useCallback(
    () => saveFileMutation.mutateAsync({ filePath, content }),
    [content, filePath, saveFileMutation],
  )
  const saveFileAs = useCallback(
    () => saveFileAsMutation.mutateAsync({ content }),
    [content, saveFileAsMutation],
  )

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
    workspaceRoot: workspace?.rootPath,
    fileTree: workspace?.tree ?? ([] as FileTreeNode[]),
    isFileBusy:
      openFileMutation.isPending ||
      openFolderMutation.isPending ||
      readFileMutation.isPending ||
      saveFileMutation.isPending ||
      saveFileAsMutation.isPending,
    openFile,
    openFolder,
    openFileFromTree,
    saveFile,
    saveFileAs,
    quitApp,
  }
}

export function useAppMeta() {
  return useQuery({
    queryKey: queryKeys.appMeta,
    queryFn: async () => {
      const platformResult = appApi.getPlatform()
      const versionResult = await appApi.getVersion()

      return {
        platform: isOk(platformResult) ? platformResult.value : '',
        version: isOk(versionResult) ? versionResult.value : '',
        error: !isOk(platformResult)
          ? platformResult.error
          : !isOk(versionResult)
            ? versionResult.error
            : null,
      }
    },
    staleTime: Infinity,
  })
}

export type { FileTreeNode }
