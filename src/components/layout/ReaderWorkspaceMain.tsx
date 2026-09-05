import { Suspense, lazy } from 'react'
import { Loader2 } from 'lucide-react'
import { FileBreadcrumb } from '@/components/layout/FileBreadcrumb'
import type { ReaderDocumentKind } from '@shared/types/document'

// 阅读器按格式懒加载：epubjs / mobi-parser / pdfjs 只在打开对应文件时进 chunk，
// 首屏（Markdown / 欢迎页）不付成本。Mermaid 本体已在 mermaid-hydrate 内动态 import，此处只拆阅读器。
const PdfViewer = lazy(() =>
  import('@/components/reader/PdfViewer').then((m) => ({ default: m.PdfViewer })),
)
const EpubViewer = lazy(() =>
  import('@/components/reader/EpubViewer').then((m) => ({ default: m.EpubViewer })),
)
const MobiViewer = lazy(() =>
  import('@/components/reader/MobiViewer').then((m) => ({ default: m.MobiViewer })),
)
const FoliateReaderViewer = lazy(() =>
  import('@/components/reader/FoliateReaderViewer').then((m) => ({ default: m.FoliateReaderViewer })),
)

/** E2E 门控：主进程经 window-init 下发，仅测试进程为 true */
function useFoliateReader(): boolean {
  return (
    typeof window !== 'undefined' && window.electronAPI?.e2eFoliateReader === true
  )
}

interface ReaderWorkspaceMainProps {
  filePath: string
  documentKind: ReaderDocumentKind
  theme: 'dark' | 'light'
}

export function ReaderWorkspaceMain({
  filePath,
  documentKind,
  theme,
}: ReaderWorkspaceMainProps) {
  const useFoliate = useFoliateReader()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <FileBreadcrumb filePath={filePath} isDirty={false} />
      <main className="min-h-0 flex-1 bg-editor">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在加载阅读器…
            </div>
          }
        >
          {useFoliate && (documentKind === 'epub' || documentKind === 'mobi') ? (
            <FoliateReaderViewer filePath={filePath} documentKind={documentKind} theme={theme} />
          ) : documentKind === 'pdf' ? (
            <PdfViewer filePath={filePath} theme={theme} />
          ) : documentKind === 'mobi' ? (
            <MobiViewer filePath={filePath} theme={theme} />
          ) : (
            <EpubViewer filePath={filePath} theme={theme} />
          )}
        </Suspense>
      </main>
    </div>
  )
}
