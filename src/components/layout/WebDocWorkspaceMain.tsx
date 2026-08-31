import { forwardRef, useImperativeHandle, useRef } from 'react'
import { WebDocViewer, type WebDocViewerHandle } from '@/components/reader/WebDocViewer'
import { WebDocAddressBar } from '@/components/layout/WebDocAddressBar'
import type { EditorOutlineState } from '@/components/layout/EditorWorkspaceMain'
import type { MarkdownHeading } from '@/lib/editor/markdown-headings'

export interface WebDocWorkspaceMainHandle {
  selectHeading: (heading: MarkdownHeading) => void
}

interface WebDocWorkspaceMainProps {
  pageUrl: string
  theme: 'dark' | 'light'
  recentUrls?: string[]
  onNavigateUrl: (url: string) => void
  onOutlineChange?: (state: EditorOutlineState) => void
}

export const WebDocWorkspaceMain = forwardRef<WebDocWorkspaceMainHandle, WebDocWorkspaceMainProps>(
  function WebDocWorkspaceMain(
    { pageUrl, theme, recentUrls = [], onNavigateUrl, onOutlineChange },
    ref,
  ) {
    const viewerRef = useRef<WebDocViewerHandle>(null)

    useImperativeHandle(
      ref,
      () => ({
        selectHeading: (heading) => viewerRef.current?.selectHeading(heading),
      }),
      [],
    )

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur-sm">
          <span className="shrink-0 text-xs text-muted-foreground">在线文档</span>
          <WebDocAddressBar pageUrl={pageUrl} recentUrls={recentUrls} onNavigate={onNavigateUrl} />
        </div>
        <main className="min-h-0 flex-1 bg-editor">
          <WebDocViewer
            ref={viewerRef}
            pageUrl={pageUrl}
            theme={theme}
            onOutlineChange={onOutlineChange}
          />
        </main>
      </div>
    )
  },
)
