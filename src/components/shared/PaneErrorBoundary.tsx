import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportRuntimeError } from '@/lib/error-reporter'

interface PaneErrorBoundaryProps {
  name: string
  filePath?: string
  children: ReactNode
}

interface PaneErrorBoundaryState {
  error: Error | null
}

/** 隔离单个面板错误，避免整页黑屏 */
export class PaneErrorBoundary extends Component<PaneErrorBoundaryProps, PaneErrorBoundaryState> {
  state: PaneErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): PaneErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRuntimeError(error, {
      source: `pane:${this.props.name}`,
      filePath: this.props.filePath,
      componentStack: info.componentStack ?? undefined,
      silentToast: true,
    })
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-editor p-6 text-center">
        <AlertTriangle className="size-8 text-destructive/80" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{this.props.name}加载失败</p>
          <p className="max-w-md text-xs text-muted-foreground">{this.state.error.message}</p>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          其余区域仍可继续使用。可在 帮助 → 错误日志 查看详情，或按 Ctrl+Shift+I 打开开发者工具。
        </p>
        <Button type="button" size="sm" variant="outline" onClick={this.handleRetry}>
          重试
        </Button>
      </div>
    )
  }
}
