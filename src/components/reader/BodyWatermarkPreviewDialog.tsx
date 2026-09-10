import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { rosettaApi } from '@/api/rosetta-api'
import { isOk } from '@shared/core/result'
import type { RosettaBodyWatermarkPreviewResult } from '@shared/types/rosetta'

interface BodyWatermarkPreviewDialogProps {
  open: boolean
  fingerprint: string
  onOpenChange: (open: boolean) => void
}

/**
 * 正文水印清洗只读预览（Phase 2.2）：只展示计数与样例，不提供任何写入入口。
 * 关闭是唯一出口；面板明确声明尚未修改数据库。
 */
export function BodyWatermarkPreviewDialog({
  open,
  fingerprint,
  onOpenChange,
}: BodyWatermarkPreviewDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<RosettaBodyWatermarkPreviewResult | null>(null)
  const [pageInput, setPageInput] = useState('')

  async function loadPreview(samplePage: number | null): Promise<void> {
    if (!fingerprint) return
    setLoading(true)
    setError(null)
    try {
      const result = await rosettaApi.previewBodyWatermark(
        samplePage === null ? { fingerprint } : { fingerprint, samplePage },
      )
      if (isOk(result)) setPreview(result.value)
      else setError(result.error.message || '预览失败')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '预览失败')
    } finally {
      setLoading(false)
    }
  }

  function handleRefreshSamples(): void {
    const text = pageInput.trim()
    if (!text) {
      void loadPreview(null)
      return
    }
    const page = Number(text)
    if (!Number.isInteger(page) || page < 1) {
      setError('页码须为正整数')
      return
    }
    void loadPreview(page)
  }

  useEffect(() => {
    if (!open || !fingerprint) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setPreview(null)
    setPageInput('')
    void (async () => {
      try {
        const result = await rosettaApi.previewBodyWatermark({ fingerprint })
        if (cancelled) return
        if (isOk(result)) setPreview(result.value)
        else setError(result.error.message || '预览失败')
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '预览失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, fingerprint])

  const reasonEntries = preview
    ? Object.entries(preview.reasonCounts).sort((a, b) => b[1] - a[1])
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col"
        aria-describedby="body-watermark-preview-desc"
      >
        <DialogHeader>
          <DialogTitle>预览正文水印清洗</DialogTitle>
          <DialogDescription id="body-watermark-preview-desc">
            只读预览，尚未修改数据库。如需处理请等待后续版本，本面板只允许关闭。
          </DialogDescription>
        </DialogHeader>

        {loading && !preview ? (
          <div className="py-10 text-center text-sm text-muted-foreground">正在只读统计…</div>
        ) : error && !preview ? (
          <div className="py-10 text-center text-sm text-destructive">{error}</div>
        ) : preview ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
            {loading ? (
              <div className="text-xs text-muted-foreground">正在只读统计…</div>
            ) : null}
            {error ? <div className="text-xs text-destructive">{error}</div> : null}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>待删 {preview.deleteCount} 条</span>
              <span>待改 {preview.updateCount} 条</span>
              <span>共 {preview.totalPatches} 条</span>
              <span>涉及 {preview.pageCount} 页</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <label htmlFor="body-watermark-sample-page">查看第 N 页候选</label>
              <Input
                id="body-watermark-sample-page"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="如 36 / 303"
                className="h-7 w-28"
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleRefreshSamples()
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                disabled={loading}
                onClick={handleRefreshSamples}
              >
                刷新
              </Button>
            </div>
            {reasonEntries.length > 0 ? (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">按原因聚合</div>
                <ul className="space-y-1 text-xs">
                  {reasonEntries.map(([reason, count]) => (
                    <li key={reason} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate" title={reason}>
                        {reason}
                      </span>
                      <span className="shrink-0 tabular-nums">× {count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                {preview.samplePage == null
                  ? '全书样例（最多 20 条，仅展示）'
                  : `第 ${preview.samplePage} 页样例（最多 20 条，仅展示）`}
              </div>
              {preview.samples.length === 0 ? (
                <div className="text-xs text-muted-foreground">暂无可清洗水印块</div>
              ) : (
                <ul className="space-y-2">
                  {preview.samples.map((sample) => (
                    <li key={sample.id} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>第 {sample.pageNumber} 页</span>
                        <span>#{sample.id}</span>
                        <span>{sample.action === 'delete' ? '删除整块' : '修剪首尾'}</span>
                      </div>
                      <div className="mt-1 truncate" title={sample.reason}>
                        {sample.reason}
                      </div>
                      <div className="mt-1 break-all">前：{sample.before}</div>
                      {sample.after !== undefined ? (
                        <div className="mt-1 break-all">后：{sample.after}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
