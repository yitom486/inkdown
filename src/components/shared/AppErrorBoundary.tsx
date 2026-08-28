import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { appApi } from '@/api/app-api'
import { formatErrorLogEntry, reportRuntimeError } from '@/lib/error-reporter'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeError(error, {
      source: 'app-root',
      componentStack: info.componentStack ?? undefined,
      silentToast: true,
    })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleOpenDevTools = (): void => {
    appApi.toggleDevTools()
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-lg font-semibold">界面渲染出错</h1>
        <p className="max-w-lg text-sm text-muted-foreground">{this.state.error.message}</p>
        {this.state.error.stack && (
          <pre className="max-h-40 max-w-2xl overflow-auto rounded-md border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            {this.state.error.stack}
          </pre>
        )}
        <p className="max-w-lg text-xs text-muted-foreground">
          错误已写入本地日志。按 Ctrl+Shift+I 或在设置 → 调试 中打开开发者工具。
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={this.handleOpenDevTools}>
            打开开发者工具
          </Button>
          <Button type="button" onClick={this.handleReload}>
            重新加载
          </Button>
        </div>
      </div>
    )
  }
}
