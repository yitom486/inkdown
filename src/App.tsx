import { useCallback, useEffect, useState } from 'react'
import { AboutDialog } from '@/components/shared/AboutDialog'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { SettingsDialog } from '@/components/shared/SettingsDialog'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { EditorLayout } from '@/components/layout/EditorLayout'
import { Toaster } from '@/components/ui/sonner'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useAppMeta, useFileOperations } from '@/hooks/useFileOperations'
import { useAppSettingsStore } from '@/stores/app-settings-store'
import { useEditorUiStore } from '@/stores/editor-ui-store'
import type { AppError } from '@shared/errors'

function App() {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lastError, setLastError] = useState<AppError | null>(null)
  const theme = useEditorUiStore((state) => state.theme)
  const autoSaveEnabled = useAppSettingsStore((state) => state.autoSaveEnabled)
  const autoSaveIntervalMs = useAppSettingsStore((state) => state.autoSaveIntervalMs)
  const recentFiles = useAppSettingsStore((state) => state.recentFiles)
  const { data: appMeta } = useAppMeta()

  const {
    content,
    setContent,
    filePath,
    fileName,
    isDirty,
    workspaceRoot,
    fileTree,
    unsavedPromptOpen,
    isFileBusy,
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
  } = useFileOperations((error) => setLastError(error))

  const handleAutoSave = useCallback(async () => {
    if (!filePath || !isDirty || isFileBusy) return
    await saveFile({ silent: true })
  }, [filePath, isDirty, isFileBusy, saveFile])

  useAutoSave({
    enabled: autoSaveEnabled,
    intervalMs: autoSaveIntervalMs,
    isDirty,
    filePath,
    isSaving: isFileBusy,
    onAutoSave: handleAutoSave,
  })

  useEffect(() => {
    if (appMeta?.error) {
      setLastError(appMeta.error)
    }
  }, [appMeta?.error])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return
      if (event.key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!window.electronAPI) {
    const isElectron = navigator.userAgent.includes('Electron')
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center text-foreground">
        <p className="text-muted-foreground">
          {isElectron
            ? 'Electron 窗口已打开，但 preload 未成功注入 API。请关闭所有 dev 进程后重新执行 bun run dev。'
            : '请在 Electron 窗口中运行此应用，浏览器预览不支持。'}
        </p>
      </div>
    )
  }

  return (
    <>
      <Toaster theme={theme} richColors closeButton position="top-right" />
      <ErrorBanner error={lastError} onDismiss={() => setLastError(null)} />
      <EditorLayout
        filePath={filePath}
        isDirty={isDirty}
        content={content}
        workspaceRoot={workspaceRoot}
        fileTree={fileTree}
        recentFiles={recentFiles}
        onContentChange={setContent}
        onOpenFile={() => void openFile()}
        onOpenFolder={() => void openFolder()}
        onSelectFile={(path) => void openFileFromTree(path)}
        onOpenRecentFile={(path) => void openRecentFile(path)}
        onSave={() => void saveFile()}
        onSaveAs={() => void saveFileAs()}
        onOpenSettings={() => setSettingsOpen(true)}
        onAbout={() => setAboutOpen(true)}
        onQuit={quitApp}
      />

      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        version={appMeta?.version || '…'}
        platform={appMeta?.platform || ''}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <UnsavedChangesDialog
        open={unsavedPromptOpen}
        fileName={fileName}
        saving={isFileBusy}
        onSave={() => void saveUnsavedChanges()}
        onDiscard={() => void discardUnsavedChanges()}
        onCancel={cancelUnsavedPrompt}
      />
    </>
  )
}

export default App
