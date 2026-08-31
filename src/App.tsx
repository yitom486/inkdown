import { useCallback, useEffect, useRef, useState } from 'react'
import { AboutDialog } from '@/components/shared/AboutDialog'
import { DraftRecoveryDialog } from '@/components/shared/DraftRecoveryDialog'
import { ErrorLogDialog } from '@/components/shared/ErrorLogDialog'
import { SettingsDialog } from '@/components/shared/SettingsDialog'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { AgentPermissionHost } from '@/components/agent/AgentPermissionHost'
import { AgentSnapshotHost } from '@/components/agent/AgentSnapshotHost'
import {
  EditorWorkspaceMain,
  type EditorOutlineState,
  type EditorWorkspaceMainHandle,
} from '@/components/layout/EditorWorkspaceMain'
import { ReaderWorkspaceMain } from '@/components/layout/ReaderWorkspaceMain'
import { WebDocWorkspaceMain } from '@/components/layout/WebDocWorkspaceMain'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { Toaster } from '@/components/ui/sonner'
import { UpdatePromptHost } from '@/components/shared/UpdatePromptHost'
import { toast } from 'sonner'
import { useAutoSave } from '@/hooks/editor/useAutoSave'
import { useDraftPersistence, clearDraftForFile } from '@/hooks/editor/useDraftPersistence'
import { useDraftRecoveryPrompt } from '@/hooks/editor/useDraftRecovery'
import { useExportDocument } from '@/hooks/editor/useExportDocument'
import { useFileTreeActions } from '@/hooks/workspace/useFileTreeActions'
import { useGlobalErrorHandlers } from '@/hooks/workspace/useGlobalErrorHandlers'
import { useAppMeta, useFileOperations } from '@/hooks/workspace/useFileOperations'
import { pickLatestRecoverableDraft } from '@/lib/editor/draft-utils'
import { reportAppError, reportUnknownError } from '@/lib/workspace/report-error'
import { appApi } from '@/api/app-api'
import { useActiveDocumentStore } from '@/stores/active-document-store'
import { useAppSettingsStore } from '@/stores/app-settings-store'
import { useDraftStore } from '@/stores/draft-store'
import { useEditorUiStore } from '@/stores/editor-ui-store'
import { useWebDocStore } from '@/stores/web-doc-store'
import { baseName } from '@/lib/agent/context/collect-turn-context'
import { registerReaderContent } from '@/lib/agent/context/reader-content-registry'
import { isMarkdownEditorFocused } from '@/lib/editor/editor-focus'
import type { MarkdownHeading } from '@/lib/editor/markdown-headings'

function App() {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [errorLogOpen, setErrorLogOpen] = useState(false)
  const [outline, setOutline] = useState<EditorOutlineState>({ headings: [] })
  const editorMainRef = useRef<EditorWorkspaceMainHandle>(null)
  const startupRestoreDoneRef = useRef(false)
  const theme = useEditorUiStore((state) => state.theme)
  const toggleTheme = useEditorUiStore((state) => state.toggleTheme)
  const toggleSidebar = useEditorUiStore((state) => state.toggleSidebar)
  const autoSaveEnabled = useAppSettingsStore((state) => state.autoSaveEnabled)
  const autoSaveIntervalMs = useAppSettingsStore((state) => state.autoSaveIntervalMs)
  const recentFiles = useAppSettingsStore((state) => state.recentFiles)
  const restoreLastFileOnStartup = useAppSettingsStore((state) => state.restoreLastFileOnStartup)
  const lastOpenedFilePath = useAppSettingsStore((state) => state.lastOpenedFilePath)
  const { data: appMeta } = useAppMeta()
  const { recoveryDraftKey, dismissRecovery } = useDraftRecoveryPrompt({
    enabled: !window.electronAPI?.isFreshWindow,
  })
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
    readerDocumentKind,
    isMarkdownDocument,
    workspaceRoot,
    fileTree,
    unsavedPromptOpen,
    isFileBusy,
    openFile,
    openFolder,
    rescanWorkspace,
    openFileFromTree,
    openRecentFile,
    saveFile,
    saveFileAs,
    restoreDraft,
    quitApp,
    cancelUnsavedPrompt,
    discardUnsavedChanges,
    saveUnsavedChanges,
    notifyPathDeleted,
    notifyPathRenamed,
    openWebDocument,
  } = useFileOperations(reportAppError)

  const webPageUrl = useWebDocStore((state) => state.pageUrl)
  const recentWebUrls = useWebDocStore((state) => state.recentUrls)

  const { exportHtml, exportPdf } = useExportDocument(content, filePath)

  const treeActions = useFileTreeActions({
    workspaceRoot,
    tree: fileTree,
    rescanWorkspace,
    onOpenFile: (path) => void openFileFromTree(path),
    onPathRemoved: notifyPathDeleted,
    onPathRenamed: notifyPathRenamed,
  })

  useDraftPersistence({
    filePath: isMarkdownDocument ? filePath : undefined,
    content,
    savedContent,
    isDirty,
  })
  useGlobalErrorHandlers(filePath)

  const handleAutoSave = useCallback(async () => {
    if (!isMarkdownDocument || !filePath || !isDirty || isFileBusy) return
    await saveFile({ silent: true })
  }, [filePath, isDirty, isFileBusy, isMarkdownDocument, saveFile])

  useAutoSave({
    enabled: autoSaveEnabled && isMarkdownDocument,
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

  const handleOutlineChange = useCallback((next: EditorOutlineState) => {
    setOutline(next)
  }, [])

  const handleSelectHeading = useCallback((heading: MarkdownHeading) => {
    editorMainRef.current?.selectHeading(heading)
  }, [])

  useEffect(() => {
    if (appMeta?.error) {
      reportAppError(appMeta.error)
    }
  }, [appMeta?.error])

  useEffect(() => {
    if (window.electronAPI?.isFreshWindow) return
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
      const mod = event.ctrlKey || event.metaKey

      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'b') {
        if (!isMarkdownEditorFocused()) {
          event.preventDefault()
          toggleSidebar()
        }
        return
      }

      if (!mod || event.shiftKey || event.altKey) return
      if (event.key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        appApi.newWindow()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSidebar])

  useEffect(() => {
    if (readerDocumentKind && filePath) {
      setOutline({ headings: [] })
    }
  }, [filePath, readerDocumentKind, webPageUrl])

  useEffect(() => {
    useActiveDocumentStore.getState().setActiveFilePath(filePath ?? webPageUrl ?? null)
  }, [filePath, webPageUrl])

  // Markdown 正文：读 ref 而非 content，避免每次按键都重新注册
  const editorContentRef = useRef(content)
  editorContentRef.current = content
  useEffect(() => {
    if (!filePath || readerDocumentKind || webPageUrl) return
    return registerReaderContent({
      filePath,
      getCurrentText: () => editorContentRef.current,
      // Markdown 只有一个单元，检索即整篇全文
      iterateUnits: async function* () {
        yield { label: baseName(filePath), text: editorContentRef.current }
      },
    })
  }, [filePath, readerDocumentKind, webPageUrl])

  const handleOpenWebDoc = useCallback(
    (url: string) => {
      if (!openWebDocument(url)) {
        toast.error('URL 无效，请输入 http(s) 链接')
      }
    },
    [openWebDocument],
  )

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

  const isReader = Boolean(readerDocumentKind && filePath)
  const isWebDoc = Boolean(webPageUrl)

  return (
    <>
      <Toaster theme={theme} richColors closeButton position="top-right" />
      <UpdatePromptHost />
      <AgentPermissionHost />
      <AgentSnapshotHost />

      <WorkspaceShell
        theme={theme}
        workspaceRoot={workspaceRoot}
        fileTree={fileTree}
        activeFilePath={filePath}
        recentFiles={recentFiles}
        treeActions={treeActions}
        headings={isReader || isWebDoc ? [] : outline.headings}
        activeHeadingId={isReader || isWebDoc ? undefined : outline.activeHeadingId}
        onSelectHeading={isReader || isWebDoc ? undefined : handleSelectHeading}
        readOnly={isReader || isWebDoc}
        onOpenFile={() => void openFile()}
        onOpenFolder={() => void openFolder()}
        onRescanWorkspace={() => void rescanWorkspace()}
        isRescanningWorkspace={isFileBusy}
        onSelectFile={(path) => void openFileFromTree(path)}
        onOpenRecentFile={(path) => void openRecentFile(path)}
        onToggleTheme={toggleTheme}
        onSave={() => void saveFile()}
        onSaveAs={() => void saveFileAs()}
        onExportHtml={handleExportHtml}
        onExportPdf={handleExportPdf}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenErrorLog={() => setErrorLogOpen(true)}
        onOpenDevTools={() => appApi.toggleDevTools()}
        onAbout={() => setAboutOpen(true)}
        onNewWindow={() => appApi.newWindow()}
        onQuit={quitApp}
      >
        {isWebDoc && webPageUrl ? (
          <WebDocWorkspaceMain
            pageUrl={webPageUrl}
            theme={theme}
            recentUrls={recentWebUrls}
            onNavigateUrl={handleOpenWebDoc}
          />
        ) : isReader && readerDocumentKind && filePath ? (
          <ReaderWorkspaceMain
            filePath={filePath}
            documentKind={readerDocumentKind}
            theme={theme}
          />
        ) : (
          <EditorWorkspaceMain
            ref={editorMainRef}
            filePath={filePath}
            isDirty={isDirty}
            content={content}
            workspaceRoot={workspaceRoot}
            recentFiles={recentFiles}
            recentWebUrls={recentWebUrls}
            onContentChange={setContent}
            onOpenFile={() => void openFile()}
            onOpenFolder={() => void openFolder()}
            onOpenRecentFile={(path) => void openRecentFile(path)}
            onOpenWebDoc={handleOpenWebDoc}
            onOutlineChange={handleOutlineChange}
          />
        )}
      </WorkspaceShell>

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
        onOpenAbout={() => setAboutOpen(true)}
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
