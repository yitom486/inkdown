import { Suspense, lazy } from 'react'
import { Loader2 } from 'lucide-react'
import { FileBreadcrumb } from '@/components/layout/FileBreadcrumb'
import type { ReaderDocumentKind } from '@shared/types/document'

// 阅读器按格式懒加载：foliate 统一承载 EPUB/MOBI，pdfjs 承载 PDF，首屏不付成本。
const PdfViewer = lazy(() =>
  import('@/components/reader/PdfViewer').then((m) => ({ default: m.PdfViewer })),
)
const FoliateReaderViewer = lazy(() =>
  import('@/components/reader/FoliateReaderViewer').then((m) => ({ default: m.FoliateReaderViewer })),
)

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
          {documentKind === 'pdf' ? (
            <PdfViewer filePath={filePath} theme={theme} />
          ) : (
            <FoliateReaderViewer filePath={filePath} documentKind={documentKind} theme={theme} />
          )}
        </Suspense>
      </main>
    </div>
  )
}
