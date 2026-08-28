import { useEffect, useState } from 'react'
import { AboutDialog } from '@/components/shared/AboutDialog'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { UnsavedChangesDialog } from '@/components/shared/UnsavedChangesDialog'
import { EditorLayout } from '@/components/layout/EditorLayout'
import { Toaster } from '@/components/ui/sonner'
import { useAppMeta, useFileOperations } from '@/hooks/useFileOperations'
import type { AppError } from '@shared/errors'

function App() {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [lastError, setLastError] = useState<AppError | null>(null)
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
    saveFile,
    saveFileAs,
    quitApp,
    cancelUnsavedPrompt,
    discardUnsavedChanges,
    saveUnsavedChanges,
  } = useFileOperations((error) => setLastError(error))

  useEffect(() => {
    if (appMeta?.error) {
      setLastError(appMeta.error)
    }
  }, [appMeta?.error])

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
      <Toaster richColors closeButton position="top-right" />
      <ErrorBanner error={lastError} onDismiss={() => setLastError(null)} />
      <EditorLayout
        filePath={filePath}
        isDirty={isDirty}
        content={content}
        workspaceRoot={workspaceRoot}
        fileTree={fileTree}
        onContentChange={setContent}
        onOpenFile={() => void openFile()}
        onOpenFolder={() => void openFolder()}
        onSelectFile={(path) => void openFileFromTree(path)}
        onSave={() => void saveFile()}
        onSaveAs={() => void saveFileAs()}
        onAbout={() => setAboutOpen(true)}
        onQuit={quitApp}
      />

      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        version={appMeta?.version || '…'}
        platform={appMeta?.platform || ''}
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
