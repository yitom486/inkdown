import { useEffect, useState } from 'react'
import { AboutDialog } from '@/components/shared/AboutDialog'
import { EditorLayout } from '@/components/layout/EditorLayout'
import { useFileOperations } from '@/hooks/useFileOperations'

function App() {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [version, setVersion] = useState('')
  const [platform, setPlatform] = useState('')

  const {
    content,
    setContent,
    fileName,
    isDirty,
    openFile,
    saveFile,
    saveFileAs,
  } = useFileOperations()

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    setPlatform(api.platform)
    api.getVersion().then(setVersion)

    return api.onShowAbout(() => setAboutOpen(true))
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
      <EditorLayout
        fileName={fileName}
        isDirty={isDirty}
        content={content}
        onContentChange={setContent}
        onOpen={() => void openFile()}
        onSave={() => void saveFile()}
        onSaveAs={() => void saveFileAs()}
        onAbout={() => setAboutOpen(true)}
      />

      <AboutDialog
        open={aboutOpen}
        onOpenChange={setAboutOpen}
        version={version || '…'}
        platform={platform}
      />
    </>
  )
}

export default App
