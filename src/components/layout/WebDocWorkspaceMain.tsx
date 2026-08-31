import { WebDocViewer } from '@/components/reader/WebDocViewer'
import { WebDocAddressBar } from '@/components/layout/WebDocAddressBar'

interface WebDocWorkspaceMainProps {
  pageUrl: string
  theme: 'dark' | 'light'
  recentUrls?: string[]
  onNavigateUrl: (url: string) => void
}

export function WebDocWorkspaceMain({
  pageUrl,
  theme,
  recentUrls = [],
  onNavigateUrl,
}: WebDocWorkspaceMainProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur-sm">
        <span className="shrink-0 text-xs text-muted-foreground">在线文档</span>
        <WebDocAddressBar pageUrl={pageUrl} recentUrls={recentUrls} onNavigate={onNavigateUrl} />
      </div>
      <main className="min-h-0 flex-1 bg-editor">
        <WebDocViewer pageUrl={pageUrl} theme={theme} />
      </main>
    </div>
  )
}
