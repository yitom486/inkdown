import { Bot, Loader2, Square, Trash2, Unplug, Wifi } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAcpSession } from '@/hooks/useAcpSession'
import { cn } from '@/lib/utils'
import { useAcpChatView, useAcpUiStore } from '@/stores/acp-ui-store'
import { BUILTIN_ACP_RUNTIMES } from '@shared/constants/acp-agents'
import type { AcpConfigOption } from '@shared/types/acp'

interface AgentPanelProps {
  workspaceRoot?: string
}

function findModelOption(options: AcpConfigOption[]): AcpConfigOption | undefined {
  return (
    options.find((o) => o.category === 'model') ??
    options.find((o) => o.configId === 'model' || /model/i.test(o.configId))
  )
}

export function AgentPanel({ workspaceRoot }: AgentPanelProps) {
  const view = useAcpChatView()
  const setSelectedRuntimeId = useAcpUiStore((s) => s.setSelectedRuntimeId)
  const setPanelOpen = useAcpUiStore((s) => s.setPanelOpen)
  const { connect, disconnect, sendPrompt, cancel, setModel, clearMessages } =
    useAcpSession(workspaceRoot)
  const [draft, setDraft] = useState('')

  const modelOption = useMemo(
    () => findModelOption(view.configOptions),
    [view.configOptions],
  )

  const statusLabel =
    view.status === 'connected'
      ? '已连接'
      : view.status === 'connecting'
        ? '连接中…'
        : view.status === 'error'
          ? '错误'
          : '未连接'

  const onSubmit = () => {
    const text = draft
    setDraft('')
    void sendPrompt(text)
  }

  return (
    <aside
      className="flex h-full w-80 shrink-0 flex-col border-r border-border/60 bg-sidebar"
      aria-label="Agent 聊天"
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <Bot className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium">Agent</span>
        <span
          className={cn(
            'ml-1 rounded px-1.5 py-0.5 text-[10px]',
            view.status === 'connected' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
            view.status === 'connecting' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
            view.status === 'error' && 'bg-destructive/15 text-destructive',
            view.status === 'disconnected' && 'bg-muted text-muted-foreground',
          )}
        >
          {statusLabel}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {view.status === 'connected' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              title="断开"
              onClick={() => void disconnect()}
            >
              <Unplug className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              title="连接"
              disabled={view.status === 'connecting'}
              onClick={() => void connect()}
            >
              {view.status === 'connecting' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wifi className="size-3.5" />
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            title="清空对话"
            onClick={clearMessages}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            title="关闭面板"
            onClick={() => setPanelOpen(false)}
          >
            ×
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border/60 p-2">
        <label className="text-[10px] text-muted-foreground">运行时</label>
        <select
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          value={view.selectedRuntimeId}
          disabled={view.status === 'connected' || view.status === 'connecting'}
          onChange={(e) => setSelectedRuntimeId(e.target.value)}
        >
          {BUILTIN_ACP_RUNTIMES.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name}
            </option>
          ))}
        </select>

        {modelOption?.options && modelOption.options.length > 0 ? (
          <>
            <label className="text-[10px] text-muted-foreground">{modelOption.name}</label>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={String(modelOption.currentValue ?? '')}
              disabled={view.status !== 'connected' || view.prompting}
              onChange={(e) => void setModel(modelOption.configId, e.target.value)}
            >
              {modelOption.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            连接后若 Agent 提供 configOptions，可在此切换模型
          </p>
        )}

        {!workspaceRoot ? (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            请先打开工作区文件夹（Agent 需要 cwd）
          </p>
        ) : (
          <p className="truncate text-[10px] text-muted-foreground" title={workspaceRoot}>
            工作区：{workspaceRoot}
          </p>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        <div className="flex flex-col gap-2">
          {view.messages.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              连接 Codex ACP 后即可对话。需本机 bunx，并设置 OPENAI_API_KEY 或 CODEX_API_KEY。
            </p>
          ) : null}
          {view.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'rounded-md px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap',
                msg.role === 'user' && 'bg-primary/10 text-foreground',
                msg.role === 'agent' && 'bg-muted/60 text-foreground',
                msg.role === 'thought' && 'bg-muted/30 text-muted-foreground italic',
                msg.role === 'system' && 'text-muted-foreground',
              )}
            >
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-60">
                {msg.role === 'user'
                  ? '你'
                  : msg.role === 'agent'
                    ? 'Agent'
                    : msg.role === 'thought'
                      ? '思考'
                      : '系统'}
                {msg.streaming ? ' …' : ''}
              </div>
              {msg.text}
            </div>
          ))}
        </div>
      </ScrollArea>

      <Separator />
      <div className="shrink-0 p-2">
        <textarea
          className="min-h-[72px] w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder={view.status === 'connected' ? '输入消息，Enter 发送' : '请先连接 Agent'}
          value={draft}
          disabled={view.status !== 'connected'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit()
            }
          }}
        />
        <div className="mt-1.5 flex items-center justify-end gap-1">
          {view.prompting ? (
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => void cancel()}>
              <Square className="size-3" />
              停止
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={view.status !== 'connected' || !draft.trim()}
              onClick={onSubmit}
            >
              发送
            </Button>
          )}
        </div>
        {view.statusError ? (
          <p className="mt-1 text-[10px] text-destructive">{view.statusError}</p>
        ) : null}
      </div>
    </aside>
  )
}
