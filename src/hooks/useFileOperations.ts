import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { appApi, fileApi } from '@/api/file-api'
import { queryKeys } from '@/api/query-keys'
import { isCancelled, type AppError } from '@shared/errors'
import type { FileTreeNode, OpenFolderResult } from '@shared/file-types'
import { isOk } from '@shared/result'
import { useAppSettingsStore } from '@/stores/app-settings-store'

function getFileName(filePath?: string): string {
  if (!filePath) return '未命名'
  return filePath.split(/[/\\]/).pop() ?? filePath
}

type UnsavedAction =
  | { kind: 'open-file' }
  | { kind: 'open-tree'; path: string }
  | { kind: 'close-app' }

export function useFileOperations(onError?: (error: AppError) => void) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [filePath, setFilePath] = useState<string>()
  const [savedContent, setSavedContent] = useState('')
  const [unsavedAction, setUnsavedAction] = useState<UnsavedAction | null>(null)
  const unsavedActionRef = useRef<UnsavedAction | null>(null)

  const isDirty = content !== savedContent
  const fileName = getFileName(filePath)

  useEffect(() => {
    unsavedActionRef.current = unsavedAction
  }, [unsavedAction])

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
      useAppSettingsStore.getState().addRecentFile(result.filePath)
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
    onSuccess: (result, path) => {
      if (!isOk(result)) {
        if (result.error.code === 'FILE_NOT_FOUND') {
          useAppSettingsStore.getState().removeRecentFile(path)
        }
        reportError(result.error)
        return
      }
      loadFile(result.value)
    },
  })

  const saveFileMutation = useMutation({
    mutationFn: (payload: { filePath?: string; content: string; silent?: boolean }) =>
      fileApi.saveFile(payload),
    onSuccess: (result, variables) => {
      if (!isOk(result)) {
        reportError(result.error)
        return
      }
      setFilePath(result.value.filePath)
      setSavedContent(variables.content)
      syncTitle(result.value.filePath, false)
      useAppSettingsStore.getState().addRecentFile(result.value.filePath)
      if (!variables.silent) {
        toast.success('已保存')
      }
    },
  })

  const saveFileAsMutation = useMutation({
    mutationFn: (payload: { content: string; silent?: boolean }) => fileApi.saveFileAs(payload),
    onSuccess: (result, variables) => {
      if (!isOk(result)) {
        reportError(result.error)
        return
      }
      setFilePath(result.value.filePath)
      setSavedContent(variables.content)
      syncTitle(result.value.filePath, false)
      useAppSettingsStore.getState().addRecentFile(result.value.filePath)
      if (!variables.silent) {
        toast.success('已保存')
      }
    },
  })

  const executeUnsavedAction = useCallback(async (action: UnsavedAction) => {
    switch (action.kind) {
      case 'open-file':
        await openFileMutation.mutateAsync()
        break
      case 'open-tree':
        await readFileMutation.mutateAsync(action.path)
        break
      case 'close-app':
        window.electronAPI?.confirmClose('proceed')
        break
    }
  }, [openFileMutation, readFileMutation])

  const promptIfDirty = useCallback(
    (action: UnsavedAction, run: () => void | Promise<void>) => {
      if (isDirty) {
        setUnsavedAction(action)
        return
      }
      void run()
    },
    [isDirty],
  )

  const openFile = useCallback(
    () => promptIfDirty({ kind: 'open-file' }, () => void openFileMutation.mutateAsync()),
    [openFileMutation, promptIfDirty],
  )

  const openFolder = useCallback(() => openFolderMutation.mutateAsync(), [openFolderMutation])

  const openFileFromTree = useCallback(
    (path: string) =>
      promptIfDirty({ kind: 'open-tree', path }, () => void readFileMutation.mutateAsync(path)),
    [promptIfDirty, readFileMutation],
  )

  const openRecentFile = useCallback(
    (path: string) =>
      promptIfDirty({ kind: 'open-tree', path }, () => void readFileMutation.mutateAsync(path)),
    [promptIfDirty, readFileMutation],
  )

  const saveFile = useCallback(
    (options?: { silent?: boolean }) =>
      saveFileMutation.mutateAsync({ filePath, content, silent: options?.silent }),
    [content, filePath, saveFileMutation],
  )

  const saveFileAs = useCallback(
    () => saveFileAsMutation.mutateAsync({ content }),
    [content, saveFileAsMutation],
  )

  const cancelUnsavedPrompt = useCallback(() => {
    const action = unsavedActionRef.current
    setUnsavedAction(null)
    if (action?.kind === 'close-app') {
      window.electronAPI?.confirmClose('cancel')
    }
  }, [])

  const discardUnsavedChanges = useCallback(async () => {
    const action = unsavedActionRef.current
    setUnsavedAction(null)
    if (action) {
      await executeUnsavedAction(action)
    }
  }, [executeUnsavedAction])

  const saveUnsavedChanges = useCallback(async () => {
    const action = unsavedActionRef.current
    const result = await saveFileMutation.mutateAsync({ filePath, content })
    if (!isOk(result)) return

    setUnsavedAction(null)
    if (action) {
      await executeUnsavedAction(action)
    }
  }, [content, executeUnsavedAction, filePath, saveFileMutation])

  const quitApp = useCallback(() => {
    window.electronAPI?.quit()
  }, [])

  useEffect(() => {
    syncTitle(filePath, isDirty)
  }, [filePath, isDirty, syncTitle])

  useEffect(() => {
    window.electronAPI?.setDirty(isDirty)
  }, [isDirty])

  useEffect(() => {
    return window.electronAPI?.onRequestClose(() => {
      setUnsavedAction({ kind: 'close-app' })
    })
  }, [])

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
    unsavedPromptOpen: unsavedAction !== null,
    isFileBusy:
      openFileMutation.isPending ||
      openFolderMutation.isPending ||
      readFileMutation.isPending ||
      saveFileMutation.isPending ||
      saveFileAsMutation.isPending,
    openFile,
    openFolder,
    openFileFromTree,
    openRecentFile,
    saveFile,
    saveFileAs,
    quitApp,
    cancelUnsavedPrompt,
    discardUnsavedChanges,
    saveUnsavedChanges,
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
