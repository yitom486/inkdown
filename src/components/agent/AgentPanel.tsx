import {
  ArrowUp,
  Bot,
  ChevronDown,
  Loader2,
  Plus,
  Settings2,
  Square,
  Trash2,
  Unplug,
  Wifi,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AgentActivityGroup,
  groupAgentMessages,
} from '@/components/agent/AgentActivityGroup'
import { AgentAuthDialog } from '@/components/agent/AgentAuthDialog'
import { AgentHistoryMenu } from '@/components/agent/AgentHistoryMenu'
import { AgentMessageBubble } from '@/components/agent/AgentMessageBubble'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAcpSession } from '@/hooks/useAcpSession'
import { cn } from '@/lib/utils'
import { useAcpChatView, useAcpUiStore } from '@/stores/acp-ui-store'
import { acpApi } from '@/api/acp-api'
import { isOk } from '@shared/core/result'
import { BUILTIN_ACP_RUNTIMES } from '@shared/constants/acp-agents'
import type { AcpConfigOption } from '@shared/types/acp'

interface AgentPanelProps {
  workspaceRoot?: string
}

const SELECT_CATEGORIES = new Set(['model', 'mode', 'thought_level', 'model_config'])

function isSelectOption(o: AcpConfigOption): boolean {
  if (o.type === 'boolean') return false
  if (!o.options || o.options.length === 0) return false
  if (o.category && SELECT_CATEGORIES.has(o.category)) return true
  return /model|mode|thought|reason|fast|collab/i.test(o.configId + o.name)
}

function rankPrimary(o: AcpConfigOption): number | null {
  const id = `${o.configId} ${o.category ?? ''} ${o.name}`.toLowerCase()
  // 输入栏只放最常改的三项，对齐 Codex/Cursor
  if (/(^|\s)mode(\s|$)/.test(id) && !/collab|model/.test(id)) return 0
  if (o.category === 'mode' && !/collab/i.test(o.name)) return 0
  if (o.category === 'model' || /(^|\s)model(\s|$)/.test(id)) return 1
  if (/thought|reason/.test(id) || o.category === 'thought_level') return 2
  return null
}

function splitConfigOptions(options: AcpConfigOption[]): {
  primary: AcpConfigOption[]
  secondary: AcpConfigOption[]
} {
  const selects = options.filter(isSelectOption)
  const primary: AcpConfigOption[] = []
  const secondary: AcpConfigOption[] = []
  const byRank = new Map<number, AcpConfigOption>()

  for (const opt of selects) {
    const rank = rankPrimary(opt)
    if (rank === null) {
      secondary.push(opt)
      continue
    }
    if (!byRank.has(rank)) byRank.set(rank, opt)
    else secondary.push(opt)
  }

  for (const rank of [0, 1, 2]) {
    const opt = byRank.get(rank)
    if (opt) primary.push(opt)
  }

  return { primary, secondary }
}

function currentLabel(opt: AcpConfigOption): string {
  const value = String(opt.currentValue ?? '')
  const match = opt.options?.find((item) => item.value === value)
  return match?.name ?? (value || opt.name)
}

function CompactConfigMenu({
  option,
  disabled,
  onChange,
  emphasize,
}: {
  option: AcpConfigOption
  disabled?: boolean
  onChange: (configId: string, value: string) => void
  emphasize?: boolean
}) {
  const label = currentLabel(option)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={option.name}
          className={cn(
            'inline-flex max-w-[7.5rem] items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] transition-colors',
            'text-muted-foreground hover:bg-muted hover:text-foreground',
            'disabled:pointer-events-none disabled:opacity-40',
            emphasize && 'font-medium text-foreground/90',
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 min-w-[10rem] overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground">
          {option.name}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(option.currentValue ?? '')}
          onValueChange={(value) => onChange(option.configId, value)}
        >
          {option.options?.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value} className="text-xs">
              {item.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AgentPanel({ workspaceRoot }: AgentPanelProps) {
  const view = useAcpChatView()
  const setSelectedRuntimeId = useAcpUiStore((s) => s.setSelectedRuntimeId)
  const setPanelOpen = useAcpUiStore((s) => s.setPanelOpen)
  const createThread = useAcpUiStore((s) => s.createThread)
  const {
    connect,
    disconnect,
    sendPrompt,
    cancel,
    setModel,
    clearMessages,
    authOpen,
    authMethods,
    authBusy,
    authError,
    completeAuth,
    cancelAuth,
  } = useAcpSession(workspaceRoot)
  const [draft, setDraft] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [authHint, setAuthHint] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { primary, secondary } = useMemo(
    () => splitConfigOptions(view.configOptions),
    [view.configOptions],
  )

  const timeline = useMemo(
    () => groupAgentMessages(view.messages),
    [view.messages],
  )

  const activeTitle = useMemo(() => {
    const thread = view.threads.find((t) => t.id === view.activeThreadId)
    return thread && thread.title !== '新对话' ? thread.title : null
  }, [view.activeThreadId, view.threads])

  const runtimeName =
    BUILTIN_ACP_RUNTIMES.find((rt) => rt.id === view.selectedRuntimeId)?.name ??
    view.selectedRuntimeId

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [view.messages, view.prompting])

  useEffect(() => {
    if (!view.prompting) return
    setNowMs(Date.now())
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [view.prompting])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await acpApi.authPreflight()
      if (cancelled || !isOk(result)) return
      const p = result.value
      if (p.looksLoggedIn) {
        const via = [
          p.hasAuthFile ? 'auth.json' : null,
          p.hasApiKeyEnv ? '环境变量 API Key' : null,
        ]
          .filter(Boolean)
          .join(' · ')
        setAuthHint(`已检测到本机 Codex 登录（${via}）`)
      } else {
        setAuthHint('未检测到本机 Codex 登录，连接后可能需要 ChatGPT / API Key 认证')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const statusLabel =
    view.status === 'connected'
      ? '已连接'
      : view.status === 'connecting'
        ? '连接中'
        : view.status === 'awaiting_auth'
          ? '待认证'
          : view.status === 'error'
            ? '错误'
            : '未连接'

  const configsDisabled = view.status !== 'connected' || view.prompting

  const onSubmit = () => {
    const text = draft
    if (!text.trim()) return
    setDraft('')
    void sendPrompt(text)
  }

  return (
    <aside
      className="flex h-full w-[22rem] shrink-0 flex-col border-r border-border/50 bg-sidebar/95 backdrop-blur-sm"
      aria-label="Agent 聊天"
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 px-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">Agent</span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                view.status === 'connected' &&
                  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                view.status === 'connecting' &&
                  'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                view.status === 'awaiting_auth' &&
                  'bg-sky-500/15 text-sky-700 dark:text-sky-400',
                view.status === 'error' && 'bg-destructive/15 text-destructive',
                view.status === 'disconnected' && 'bg-muted text-muted-foreground',
              )}
            >
              {view.status === 'connecting' ? (
                <Loader2 className="size-2.5 animate-spin" />
              ) : (
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    view.status === 'connected' && 'bg-emerald-500',
                    view.status === 'error' && 'bg-destructive',
                    view.status === 'disconnected' && 'bg-muted-foreground/50',
                  )}
                />
              )}
              {statusLabel}
            </span>
          </div>
          {activeTitle ? (
            <p className="truncate text-[10px] text-muted-foreground" title={activeTitle}>
              {activeTitle}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          {view.status === 'connected' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg"
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
              className="size-7 rounded-lg"
              title="连接"
              disabled={view.status === 'connecting' || view.status === 'awaiting_auth'}
              onClick={() => void connect()}
            >
              {view.status === 'connecting' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wifi className="size-3.5" />
              )}
            </Button>
          )}
          <AgentHistoryMenu workspaceRoot={workspaceRoot} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg"
            title="新对话"
            disabled={view.prompting}
            onClick={() => createThread(workspaceRoot)}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg"
            title="清空当前对话"
            onClick={clearMessages}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg"
            title="关闭面板"
            onClick={() => setPanelOpen(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {!workspaceRoot ? (
        <div className="shrink-0 border-b border-border/50 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-700 dark:text-amber-400">
          请先打开工作区文件夹（Agent 需要 cwd）
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-3 py-3">
          {view.messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-3 py-4 text-center">
              <Bot className="mx-auto mb-2 size-6 text-muted-foreground/60" />
              <p className="text-xs font-medium text-foreground/80">开始与 Codex 对话</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                点击右上角连接。复用本机 Codex 登录或环境变量中的 API Key。
              </p>
              {authHint ? (
                <p
                  className={cn(
                    'mt-2 rounded-md px-2 py-1.5 text-[10px] leading-relaxed',
                    authHint.startsWith('已检测')
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                  )}
                >
                  {authHint}
                </p>
              ) : null}
            </div>
          ) : null}
          {timeline.map((item) =>
            item.type === 'activity' ? (
              <AgentActivityGroup
                key={item.messages.map((m) => m.id).join('-')}
                messages={item.messages}
                nowMs={nowMs}
              />
            ) : (
              <AgentMessageBubble key={item.message.id} message={item.message} />
            ),
          )}
          {view.prompting &&
          !view.messages.some((m) => m.streaming) ? (
            <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              正在生成…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 space-y-1.5 p-3 pt-2">
        <div className="rounded-2xl border border-border/70 bg-background shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
          <textarea
            className="min-h-[72px] w-full resize-none rounded-t-2xl bg-transparent px-3 py-2.5 text-xs leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
            placeholder={
              view.status === 'connected'
                ? '输入消息，Enter 发送 · Shift+Enter 换行'
                : '请先连接 Agent'
            }
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

          <div className="flex items-center gap-0.5 border-t border-border/40 px-1.5 py-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="更多设置"
                >
                  <Settings2 className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                  运行时
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={view.selectedRuntimeId}
                  onValueChange={setSelectedRuntimeId}
                >
                  {BUILTIN_ACP_RUNTIMES.map((rt) => (
                    <DropdownMenuRadioItem
                      key={rt.id}
                      value={rt.id}
                      disabled={
                        view.status === 'connected' ||
                        view.status === 'connecting' ||
                        view.status === 'awaiting_auth'
                      }
                      className="text-xs"
                    >
                      {rt.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>

                {secondary.length > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                      其它配置
                    </DropdownMenuLabel>
                    {secondary.map((opt) => (
                      <div key={opt.configId} className="px-2 py-1.5">
                        <p className="mb-1 text-[10px] text-muted-foreground">{opt.name}</p>
                        <select
                          className="h-7 w-full rounded-md border border-border/70 bg-background px-2 text-[11px] outline-none disabled:opacity-50"
                          value={String(opt.currentValue ?? '')}
                          disabled={configsDisabled}
                          onChange={(e) => void setModel(opt.configId, e.target.value)}
                        >
                          {opt.options?.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </>
                ) : null}

                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground">工作区</p>
                  <p className="mt-0.5 truncate text-[11px]" title={workspaceRoot ?? ''}>
                    {workspaceRoot ?? '未打开'}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground" title={runtimeName}>
                    当前运行时 · {runtimeName}
                  </p>
                  {authHint ? (
                    <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                      {authHint}
                    </p>
                  ) : null}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
              {primary.map((opt, index) => (
                <CompactConfigMenu
                  key={opt.configId}
                  option={opt}
                  disabled={configsDisabled}
                  onChange={(configId, value) => void setModel(configId, value)}
                  emphasize={index === 0}
                />
              ))}
              {view.status === 'connected' && primary.length === 0 ? (
                <span className="px-1 text-[10px] text-muted-foreground">无会话配置项</span>
              ) : null}
            </div>

            {view.prompting ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7 shrink-0 rounded-full"
                title="停止"
                onClick={() => void cancel()}
              >
                <Square className="size-3" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                className="size-7 shrink-0 rounded-full"
                title="发送"
                disabled={view.status !== 'connected' || !draft.trim()}
                onClick={onSubmit}
              >
                <ArrowUp className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {view.statusError ? (
          <p className="text-[10px] text-destructive">{view.statusError}</p>
        ) : null}
      </div>

      <AgentAuthDialog
        open={authOpen}
        methods={authMethods}
        busy={authBusy}
        error={authError}
        onSelect={(methodId) => void completeAuth(methodId)}
        onCancel={() => void cancelAuth()}
      />
    </aside>
  )
}
