import { WebDocViewer } from '@/components/reader/WebDocViewer'
import { formatWebDocPathLabel } from '@/lib/reader/web-doc-site'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'

interface WebDocWorkspaceMainProps {
  pageUrl: string
  theme: 'dark' | 'light'
}

export function WebDocWorkspaceMain({ pageUrl, theme }: WebDocWorkspaceMainProps) {
  let host = '在线文档'
  try {
    host = new URL(pageUrl).hostname
  } catch {
    // keep fallback
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center border-b border-border/60 bg-background/80 px-4 backdrop-blur-sm">
        <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className="text-muted-foreground">在线文档</span>
            </BreadcrumbItem>
            <span className="text-muted-foreground">/</span>
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate font-medium" title={pageUrl}>
                {host} · {formatWebDocPathLabel(pageUrl)}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <main className="min-h-0 flex-1 bg-editor">
        <WebDocViewer pageUrl={pageUrl} theme={theme} />
      </main>
    </div>
  )
}
