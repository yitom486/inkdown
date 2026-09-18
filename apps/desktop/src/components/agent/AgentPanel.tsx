import {
  ChevronDown,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  Unplug,
  Wifi,
  X,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AgentComposer } from '@/components/agent/AgentComposer'
import { AgentMark } from '@/components/agent/AgentMark'
import { AgentAuthDialog } from '@/components/agent/AgentAuthDialog'
import { AgentProviderDialog } from '@/components/agent/AgentProviderDialog'
import { AgentBunInstallBanner } from '@/components/agent/AgentBunInstallBanner'
import { AgentHistoryMenu } from '@/components/agent/AgentHistoryMenu'
import { CompactConfigMenu } from '@/components/agent/CompactConfigMenu'
import { AgentMessageList } from '@/components/agent/chat/AgentMessageList'
import type { ChapterMarkPlanSelectPayload } from '@/components/agent/propose/ChapterMarkPlanCard'
import { Button } from '@/components/ui/button'
import { appendSelectionChatMarker } from '@/lib/agent/context/selection-chat-marker'
import { splitConfigOptions } from '@/lib/agent/acp-config-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAcpSession } from '@/hooks/agent/useAcpSession'
import { useHighlightTheme } from '@/hooks/preview/useHighlightTheme'
import { cn } from '@/lib/utils'
import { useAcpChatShell, useAcpUiStore } from '@/stores/acp-ui-store'
import { useEditorUiStore } from '@/stores/editor-ui-store'
import { acpApi } from '@/api/acp-api'
import { isOk } from '@inkdown/contracts'
import { BUILTIN_ACP_RUNTIMES, DEFAULT_ACP_RUNTIME_ID } from '@inkdown/contracts'
import type { AcpConfigOption, AcpProviderStatus, AcpProxySettings } from '@inkdown/contracts'

interface AgentPanelProps {
  workspaceRoot?: string
}

export const AgentPanel = memo(function AgentPanel({ workspaceRoot }: AgentPanelProps) {
  const view = useAcpChatShell()
  const setSelectedRuntimeId = useAcpUiStore((s) => s.setSelectedRuntimeId)
  const setPanelOpen = useAcpUiStore((s) => s.setPanelOpen)
  const createThread = useAcpUiStore((s) => s.createThread)
  const {
    connect,
    disconnect,
    syncAgentSessionToActiveThread,
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
  const [authHint, setAuthHint] = useState<string | null>(null)
  const composerInsertNonce = useAcpUiStore((s) => s.composerInsertNonce)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const theme = useEditorUiStore((s) => s.theme)

  useHighlightTheme(theme)

  const selectChapterMarkPlan = useAcpUiStore((s) => s.selectChapterMarkPlan)

  const handleChapterPlanSelect = useCallback(
    (payload: ChapterMarkPlanSelectPayload) => {
      selectChapterMarkPlan(payload.entry.id)
      void sendPrompt({
        text: payload.displayText,
        prompt: [{ type: 'text', text: payload.promptText }],
      })
    },
    [selectChapterMarkPlan, sendPrompt],
  )

  useEffect(() => {
    if (composerInsertNonce === 0) return
    setDraft((prev) => appendSelectionChatMarker(prev))
  }, [composerInsertNonce])

  const { primary, secondary } = useMemo(
    () => splitConfigOptions(view.configOptions),
    [view.configOptions],
  )

  const runtimeName =
    BUILTIN_ACP_RUNTIMES.find((rt) => rt.id === view.selectedRuntimeId)?.name ??
    view.selectedRuntimeId

  /** Codex 专属能力：本机登录提示 / 自定义 API 仅 codex-acp 运行时可用 */
  const isCodexRuntime = view.selectedRuntimeId === DEFAULT_ACP_RUNTIME_ID

  useEffect(() => {
    let cancelled = false
    if (!isCodexRuntime) {
      setProviderStatus(null)
      setAuthHint(null)
      return
    }
    void (async () => {
      const providerResult = await acpApi.getProvider()
      if (cancelled) return
      if (isOk(providerResult) && providerResult.value.configured) {
        setProviderStatus(providerResult.value)
        setAuthHint(
          `已启用自定义 API（${providerResult.value.name ?? '自定义'} · ${
            providerResult.value.model ?? ''
          }），连接时使用该 Key 认证`,
        )
        return
      }
      const result = await acpApi.authPreflight({ runtimeId: view.selectedRuntimeId })
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
  }, [isCodexRuntime, view.selectedRuntimeId])

  // 代理设置：全局一份，spawn Agent 子进程时注入；保存后需重新连接
  const [proxySettings, setProxySettings] = useState<AcpProxySettings | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await acpApi.getProxySettings()
      if (cancelled) return
      if (isOk(result)) setProxySettings(result.value)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const updateProxySettings = useCallback(
    (patch: Partial<AcpProxySettings>) => {
      setProxySettings((prev) => {
        const next: AcpProxySettings = {
          enabled: prev?.enabled ?? false,
          host: prev?.host ?? '127.0.0.1',
          port: prev?.port ?? 7897,
          ...patch,
        }
        void acpApi.saveProxySettings(next)
        return next
      })
    },
    [],
  )

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

  const [providerDialogOpen, setProviderDialogOpen] = useState(false)
  const [providerStatus, setProviderStatus] = useState<AcpProviderStatus | null>(null)

  return (
    <aside
      className="flex h-full w-full min-w-0 flex-col border-l border-border/50 bg-sidebar/95 backdrop-blur-sm"
      role="region"
      aria-label="Agent 聊天"
      data-testid="agent-panel"
      data-keep-reader-selection
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/50 px-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <AgentMark className="size-4" />
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
          {view.activeTitle ? (
            <p className="truncate text-[10px] text-muted-foreground" title={view.activeTitle}>
              {view.activeTitle}
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
          <AgentHistoryMenu
            workspaceRoot={workspaceRoot}
            onAfterSwitchThread={() => void syncAgentSessionToActiveThread()}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg"
            title="新对话"
            disabled={view.prompting}
            onClick={() => {
              createThread(workspaceRoot)
              void syncAgentSessionToActiveThread()
            }}
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
        <div className="shrink-0 border-b border-border/50 bg-sky-500/10 px-3 py-1.5 text-[10px] text-sky-800 dark:text-sky-300">
          当前为网页会话（无本地工作区）；可读在线文档，附加本地文件需先打开文件夹
        </div>
      ) : null}

      <AgentMessageList
        bottomRef={bottomRef}
        messagesRef={messagesRef}
        authHint={authHint}
        onChapterPlanSelect={handleChapterPlanSelect}
      />

      <div className="shrink-0 space-y-1.5 p-3 pt-2">
        <AgentComposer
          disabled={
            view.status === 'connecting' ||
            view.status === 'awaiting_auth'
          }
          prompting={view.prompting}
          workspaceRoot={workspaceRoot}
          promptCapabilities={view.promptCapabilities}
          draft={draft}
          onDraftChange={setDraft}
          onCancel={() => void cancel()}
          onSubmit={(payload) => {
            void sendPrompt({
              text: payload.text,
              prompt: payload.prompt,
              messageAttachments: payload.messageAttachments,
            })
          }}
          toolbarStart={
            <>
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

                  <DropdownMenuSeparator />
                  {isCodexRuntime ? (
                    <>
                      <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                        认证 / 供应商
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        className="text-xs"
                        onSelect={() => setProviderDialogOpen(true)}
                      >
                        自定义 API…
                        {providerStatus?.configured ? (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {providerStatus.name ?? '已配置'}
                          </span>
                        ) : null}
                      </DropdownMenuItem>
                    </>
                  ) : null}

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                    代理（Agent 子进程）
                  </DropdownMenuLabel>
                  <div className="flex items-center justify-between px-2 py-1">
                    <label
                      className="flex cursor-pointer items-center gap-2 text-xs"
                      title="连接 Agent 时注入 HTTP(S)_PROXY 环境变量"
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[hsl(var(--primary))]"
                        checked={proxySettings?.enabled ?? false}
                        disabled={view.status === 'connected' || view.status === 'connecting' || view.status === 'awaiting_auth'}
                        onChange={(e) => updateProxySettings({ enabled: e.target.checked })}
                      />
                      启用代理
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        className="h-6 w-24 rounded-md border border-border/70 bg-background px-1.5 text-[11px] outline-none disabled:opacity-50"
                        value={proxySettings?.host ?? '127.0.0.1'}
                        disabled={!proxySettings?.enabled}
                        spellCheck={false}
                        onChange={(e) => updateProxySettings({ host: e.target.value })}
                      />
                      <span className="text-[10px] text-muted-foreground">:</span>
                      <input
                        className="h-6 w-14 rounded-md border border-border/70 bg-background px-1.5 text-[11px] outline-none disabled:opacity-50"
                        value={proxySettings?.port ?? 7897}
                        disabled={!proxySettings?.enabled}
                        inputMode="numeric"
                        onChange={(e) => {
                          const port = Number(e.target.value)
                          if (Number.isInteger(port) && port >= 1 && port <= 65535) {
                            updateProxySettings({ port })
                          }
                        }}
                      />
                    </div>
                  </div>
                  <p className="px-2 pb-1 text-[10px] text-muted-foreground">
                    仅对 Agent 进程生效；保存后需重新连接
                  </p>

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
                      {workspaceRoot ?? '网页会话（应用沙箱）'}
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
            </>
          }
        />

        {view.statusErrorCode === 'BUN_NOT_INSTALLED' ? (
          <AgentBunInstallBanner onInstalled={() => void connect()} />
        ) : view.statusError ? (
          <p className="px-3 pb-2 text-[10px] text-destructive">{view.statusError}</p>
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

      <AgentProviderDialog
        open={providerDialogOpen}
        onOpenChange={setProviderDialogOpen}
        onChanged={(status) => {
          setProviderStatus(status)
          if (status.configured) {
            setAuthHint(
              `已启用自定义 API（${status.name ?? '自定义'} · ${status.model ?? ''}），连接时使用该 Key 认证`,
            )
            if (view.status === 'disconnected' || view.status === 'error') {
              void connect()
            }
          } else {
            setAuthHint('已清除自定义 API，连接时回到本机 ~/.codex 订阅登录')
          }
        }}
      />
    </aside>
  )
})
