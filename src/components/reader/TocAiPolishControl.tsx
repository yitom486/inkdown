import { useCallback, useEffect, useRef, useState } from 'react'
import { BotMessageSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { acpApi } from '@/api/acp-api'
import { isOk } from '@shared/core/result'
import { useAcpUiStore } from '@/stores/acp-ui-store'
import type { AcpConfigOption } from '@shared/types/acp'
import type { OcrTocEntry } from '@shared/types/ocr'
import { buildTocAiPrompt, parseTocAiEntries } from '@/lib/reader/toc-ai'
import {
  ensureTocSessionId,
  pickTocModelOptions,
  pickTocThoughtOptions,
  sendTocPrompt,
} from '@/lib/agent/toc-ai-session'

interface TocAiPolishControlProps {
  /** 目录范围页的 OCR 原文（调用方按需识别后拼接） */
  getOcrText: () => Promise<string | null>
  /** 解析出的条目进编辑器草稿（用户核对后才保存） */
  onApply: (entries: OcrTocEntry[]) => void
  disabled?: boolean
}

interface SelectState {
  configId: string
  value: string
}

type Phase = 'idle' | 'preparing' | 'ready' | 'working'

function defaultSelect(options: readonly AcpConfigOption[]): SelectState | null {
  const group = options[0]
  if (!group || !group.options || group.options.length === 0) return null
  const current = group.currentValue == null ? '' : String(group.currentValue)
  const value = group.options.some((o) => o.value === current)
    ? current
    : group.options[0]!.value
  return { configId: group.configId, value }
}

/**
 * 目录校正 editors 内的“AI 整理”：新建目录副会话 → 可选模型/思考档 →
 * 发 OCR 原文 → JSON 解析校验 → 回填草稿。不进右侧时间线。
 */
export function TocAiPolishControl({ getOcrText, onApply, disabled }: TocAiPolishControlProps) {
  const agentConnected = useAcpUiStore((s) => s.status === 'connected')
  const mainPrompting = useAcpUiStore((s) => s.prompting)
  const [phase, setPhase] = useState<Phase>('idle')
  const [modelOptions, setModelOptions] = useState<AcpConfigOption[]>([])
  const [thoughtOptions, setThoughtOptions] = useState<AcpConfigOption[]>([])
  const [model, setModel] = useState<SelectState | null>(null)
  const [thought, setThought] = useState<SelectState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const busy = phase === 'preparing' || phase === 'working'
  const blocked = disabled === true || mainPrompting || busy

  const handlePrepare = useCallback(async () => {
    if (!agentConnected) {
      toast.error('请先连接 AI')
      return
    }
    setError(null)
    setPhase('preparing')
    const session = await ensureTocSessionId()
    if (!mountedRef.current) return
    if (!session) {
      setError('AI 会话创建失败，请稍后重试')
      setPhase('idle')
      return
    }
    sessionRef.current = session.sessionId
    setModelOptions(pickTocModelOptions(session.configOptions))
    setThoughtOptions(pickTocThoughtOptions(session.configOptions))
    setModel(defaultSelect(pickTocModelOptions(session.configOptions)))
    setThought(defaultSelect(pickTocThoughtOptions(session.configOptions)))
    setPhase('ready')
  }, [agentConnected])

  const handleStart = useCallback(async () => {
    const sid = sessionRef.current
    if (!sid) {
      setError('会话已失效，请重新点击 AI 整理')
      setPhase('idle')
      return
    }
    setError(null)
    setPhase('working')
    try {
      for (const override of [model, thought]) {
        if (!override) continue
        const applied = await acpApi.setConfigOption({
          sessionId: sid,
          configId: override.configId,
          value: override.value,
        })
        if (!isOk(applied)) {
          throw new Error('模型配置应用失败')
        }
      }
      const text = await getOcrText()
      if (!mountedRef.current) return
      if (!text) {
        toast.error('目录页无可用 OCR 文本，请先识别目录')
        setPhase('ready')
        return
      }
      const reply = await sendTocPrompt(buildTocAiPrompt(text))
      if (!mountedRef.current) return
      if (!reply) {
        setError('AI 无回复，请重试')
        setPhase('ready')
        return
      }
      const parsed = parseTocAiEntries(reply)
      if (parsed.entries.length === 0) {
        setError(parsed.warnings[0] ?? '未能解析出条目')
        setPhase('ready')
        return
      }
      onApply(parsed.entries)
      for (const warning of parsed.warnings) toast.message(warning)
      toast.success(`AI 整理出 ${parsed.entries.length} 条，已填入草稿，请核对后保存`)
      setPhase('idle')
    } catch (cause) {
      if (!mountedRef.current) return
      setError(cause instanceof Error ? cause.message : 'AI 整理失败')
      setPhase('ready')
    }
  }, [getOcrText, model, onApply, thought])

  const handleCancel = useCallback(() => {
    sessionRef.current = null
    setError(null)
    setPhase('idle')
  }, [])

  if (phase === 'ready') {
    const modelGroup = modelOptions[0]
    const thoughtGroup = thoughtOptions[0]
    return (
      <div className="space-y-2 rounded-md border border-border/60 bg-background/60 p-2">
        {modelGroup?.options ? (
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            模型
            <select
              className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1.5 py-1 text-xs text-foreground"
              value={model?.value ?? ''}
              onChange={(e) =>
                setModel(
                  model ? { ...model, value: e.target.value } : null,
                )
              }
            >
              {modelGroup.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.name || o.value}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {thoughtGroup?.options ? (
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            思考档
            <select
              className="min-w-0 flex-1 rounded border border-border/60 bg-background px-1.5 py-1 text-xs text-foreground"
              value={thought?.value ?? ''}
              onChange={(e) =>
                setThought(
                  thought ? { ...thought, value: e.target.value } : null,
                )
              }
            >
              {thoughtGroup.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.name || o.value}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7 flex-1 text-xs"
            disabled={mainPrompting}
            onClick={() => void handleStart()}
          >
            开始整理
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={busy}
            onClick={handleCancel}
          >
            取消
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 w-full text-xs"
        disabled={blocked || !agentConnected}
        title={agentConnected ? '用 AI 整理目录 OCR 文本' : '请先连接 AI'}
        onClick={() => void handlePrepare()}
      >
        {busy ? (
          <Loader2 className="mr-1 size-3.5 animate-spin" />
        ) : (
          <BotMessageSquare className="mr-1 size-3.5" />
        )}
        {phase === 'preparing' ? '准备会话…' : phase === 'working' ? '整理中…' : 'AI 整理'}
      </Button>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
