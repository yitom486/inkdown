import { Suspense, forwardRef, lazy, useImperativeHandle, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import type { WebDocViewerHandle } from '@/components/reader/WebDocViewer'
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

// 在线文档 Viewer 按需加载：katex/阅读抽取链只在打开 URL 时进 chunk，首屏不付成本。
// 底盒 forwardRef 能力由 lazy 包裹保留，ref 透传给内部 selectHeading。
const WebDocViewer = lazy(() =>
  import('@/components/reader/WebDocViewer').then((m) => ({ default: m.WebDocViewer })),
)

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
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在加载在线文档阅读器…
              </div>
            }
          >
            <WebDocViewer
              ref={viewerRef}
              pageUrl={pageUrl}
              theme={theme}
              onOutlineChange={onOutlineChange}
            />
          </Suspense>
        </main>
      </div>
    )
  },
)
