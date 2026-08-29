import { FileBreadcrumb } from '@/components/layout/FileBreadcrumb'
import { EpubViewer } from '@/components/reader/EpubViewer'
import { MobiViewer } from '@/components/reader/MobiViewer'
import { PdfViewer } from '@/components/reader/PdfViewer'
import type { ReaderDocumentKind } from '@shared/types/document'

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
        {documentKind === 'pdf' ? (
          <PdfViewer filePath={filePath} theme={theme} />
        ) : documentKind === 'mobi' ? (
          <MobiViewer filePath={filePath} theme={theme} />
        ) : (
          <EpubViewer filePath={filePath} theme={theme} />
        )}
      </main>
    </div>
  )
}
