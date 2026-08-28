import { useCallback, useEffect, useRef, useState } from 'react'
import { AboutDialog } from '@/components/shared/AboutDialog'
import { DraftRecoveryDialog } from '@/components/shared/DraftRecoveryDialog'
import { ErrorLogDialog } from '@/components/shared/ErrorLogDialog'
import { SettingsDialog } from '@/components/shared/SettingsDialog'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { EditorLayout } from '@/components/layout/EditorLayout'
import { Toaster } from '@/components/ui/sonner'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useDraftPersistence, clearDraftForFile } from '@/hooks/useDraftPersistence'
import { useDraftRecoveryPrompt } from '@/hooks/useDraftRecovery'
import { useExportDocument } from '@/hooks/useExportDocument'
import { useGlobalErrorHandlers } from '@/hooks/useGlobalErrorHandlers'
import { useAppMeta, useFileOperations } from '@/hooks/useFileOperations'
import { pickLatestRecoverableDraft } from '@/lib/draft-utils'
import { reportAppError, reportUnknownError } from '@/lib/report-error'
import { appApi } from '@/api/app-api'
import { useAppSettingsStore } from '@/stores/app-settings-store'
import { useDraftStore } from '@/stores/draft-store'
import { useEditorUiStore } from '@/stores/editor-ui-store'

function App() {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [errorLogOpen, setErrorLogOpen] = useState(false)
  const startupRestoreDoneRef = useRef(false)
  const theme = useEditorUiStore((state) => state.theme)
  const autoSaveEnabled = useAppSettingsStore((state) => state.autoSaveEnabled)
  const autoSaveIntervalMs = useAppSettingsStore((state) => state.autoSaveIntervalMs)
  const recentFiles = useAppSettingsStore((state) => state.recentFiles)
  const restoreLastFileOnStartup = useAppSettingsStore((state) => state.restoreLastFileOnStartup)
  const lastOpenedFilePath = useAppSettingsStore((state) => state.lastOpenedFilePath)
  const { data: appMeta } = useAppMeta()
  const { recoveryDraftKey, dismissRecovery } = useDraftRecoveryPrompt()
  const recoveryDraft = useDraftStore((state) =>
    recoveryDraftKey ? state.drafts[recoveryDraftKey] : null,
  )
  const removeDraft = useDraftStore((state) => state.removeDraft)

  const {
    content,
    setContent,
    filePath,
    fileName,
    savedContent,
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
    restoreDraft,
    quitApp,
    cancelUnsavedPrompt,
    discardUnsavedChanges,
    saveUnsavedChanges,
  } = useFileOperations(reportAppError)

  const { exportHtml, exportPdf } = useExportDocument(content, filePath)

  useDraftPersistence({ filePath, content, savedContent, isDirty })
  useGlobalErrorHandlers(filePath)

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

  const handleExportHtml = useCallback(() => {
    void exportHtml().catch(reportUnknownError)
  }, [exportHtml])

  const handleExportPdf = useCallback(() => {
    void exportPdf().catch(reportUnknownError)
  }, [exportPdf])

  const handleRestoreDraft = useCallback(() => {
    if (!recoveryDraft || !recoveryDraftKey) return
    restoreDraft(recoveryDraft)
    clearDraftForFile(recoveryDraft.filePath)
    dismissRecovery()
  }, [dismissRecovery, recoveryDraft, recoveryDraftKey, restoreDraft])

  const handleDiscardDraft = useCallback(() => {
    if (recoveryDraftKey) {
      removeDraft(recoveryDraftKey)
    }
    dismissRecovery()
  }, [dismissRecovery, recoveryDraftKey, removeDraft])

  useEffect(() => {
    if (appMeta?.error) {
      reportAppError(appMeta.error)
    }
  }, [appMeta?.error])

  useEffect(() => {
    if (startupRestoreDoneRef.current) return
    startupRestoreDoneRef.current = true

    const hadRecoverableDraft =
      pickLatestRecoverableDraft(useDraftStore.getState().drafts) !== null
    if (hadRecoverableDraft) return

    if (restoreLastFileOnStartup && lastOpenedFilePath) {
      void openRecentFile(lastOpenedFilePath)
    }
  }, [lastOpenedFilePath, openRecentFile, restoreLastFileOnStartup])

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
        onExportHtml={handleExportHtml}
        onExportPdf={handleExportPdf}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenErrorLog={() => setErrorLogOpen(true)}
        onOpenDevTools={() => appApi.toggleDevTools()}
        onAbout={() => setAboutOpen(true)}
        onQuit={quitApp}
      />

      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        version={appMeta?.version || '…'}
        platform={appMeta?.platform || ''}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOpenErrorLog={() => setErrorLogOpen(true)}
      />

      <ErrorLogDialog open={errorLogOpen} onOpenChange={setErrorLogOpen} />

      <DraftRecoveryDialog
        open={recoveryDraftKey !== null}
        draft={recoveryDraft}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
      />

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
