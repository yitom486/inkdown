import type { ReactNode } from 'react'
import { Clock, FileText, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath
}

interface WelcomePageProps {
  recentFiles: string[]
  workspaceRoot?: string
  onOpenFile: () => void
  onOpenFolder: () => void
  onOpenRecentFile: (path: string) => void
}

interface WelcomeActionProps {
  icon: ReactNode
  title: string
  hint: string
  onClick: () => void
}

function WelcomeAction({ icon, title, hint, onClick }: WelcomeActionProps) {
  return (
    <Button
      variant="outline"
      className="h-auto w-full justify-start gap-3 px-4 py-3 text-left"
      onClick={onClick}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </Button>
  )
}

export function WelcomePage({
  recentFiles,
  workspaceRoot,
  onOpenFile,
  onOpenFolder,
  onOpenRecentFile,
}: WelcomePageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-auto bg-editor px-6 py-10">
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">轻量阅读器</h1>
          <p className="text-sm text-muted-foreground">
            Markdown 编辑 · PDF / EPUB / MOBI 阅读
          </p>
        </div>

        <div className="space-y-2">
          <WelcomeAction
            icon={<FileText className="size-5" />}
            title="打开文件"
            hint="Ctrl+O · 支持 Markdown、PDF、EPUB、MOBI"
            onClick={onOpenFile}
          />
          <WelcomeAction
            icon={<FolderOpen className="size-5" />}
            title="打开文件夹"
            hint="Ctrl+Shift+O · 在侧栏浏览工作区"
            onClick={onOpenFolder}
          />
        </div>

        {recentFiles.length > 0 && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="size-4" />
              最近打开
            </h2>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-background/50">
              {recentFiles.map((path) => (
                <li key={path}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm',
                      'hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none',
                    )}
                    title={path}
                    onClick={() => onOpenRecentFile(path)}
                  >
                    <span className="truncate font-medium">{getFileName(path)}</span>
                    <span className="truncate text-xs text-muted-foreground">{path}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {workspaceRoot && (
          <p className="text-center text-xs text-muted-foreground">
            当前工作区：{workspaceRoot}
          </p>
        )}
      </div>
    </div>
  )
}
