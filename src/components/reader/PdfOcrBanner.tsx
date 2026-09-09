import { Loader2, ScanText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

export type PdfOcrBannerMode =
  | 'scanned-no-outline'
  | 'mixed-no-outline'
  | 're-recognize-toc'
  | 'recognizing'

interface PdfOcrBannerProps {
  mode: PdfOcrBannerMode
  tocPageFrom: number
  tocPageTo: number
  tocPageOffset: number
  onTocPageFromChange: (value: number) => void
  onTocPageToChange: (value: number) => void
  onTocPageOffsetChange: (value: number) => void
  onRecognize: () => void
  onDismiss: () => void
  entryCount?: number
  /** 自动推算偏移（调用方做标题锚定共识）；不传则不显示按钮 */
  onSuggestOffset?: () => void
  suggestingOffset?: boolean
  /** 自动查找目录页（只建议范围，不识别）；不传则不显示按钮 */
  onDetectTocPages?: () => void
  detectingTocPages?: boolean
  /** 目录三操作任一运行中：两个入口按钮同步禁用（锁负责逻辑互斥） */
  busy?: boolean
  extraActions?: ReactNode
}

export function PdfOcrBanner({
  mode,
  tocPageFrom,
  tocPageTo,
  tocPageOffset,
  onTocPageFromChange,
  onTocPageToChange,
  onTocPageOffsetChange,
  onRecognize,
  onDismiss,
  entryCount,
  onSuggestOffset,
  suggestingOffset = false,
  onDetectTocPages,
  detectingTocPages = false,
  busy = false,
  extraActions,
}: PdfOcrBannerProps) {
  const recognizeLabel = mode === 're-recognize-toc' ? '重新识别' : '识别目录'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
      <ScanText className="size-4 shrink-0 opacity-80" aria-hidden />
      <div className="min-w-0 flex-1">
        {mode === 'recognizing' ? (
          <p className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            正在识别目录页，首次使用会下载 OCR 语言包…
          </p>
        ) : mode === 're-recognize-toc' ? (
          <>
            <p className="font-medium">
              OCR 目录{entryCount ? `（${entryCount} 条）` : ''}
            </p>
            <p className="text-amber-900/80 dark:text-amber-100/80">
              调整目录页范围或页码偏移后重新识别。偏移错误会导致章节跳转不准。
            </p>
          </>
        ) : mode === 'mixed-no-outline' ? (
          <>
            <p className="font-medium">混合版 PDF，无嵌入目录</p>
            <p className="text-amber-900/80 dark:text-amber-100/80">
              原生文字页可直接划词；扫描页按需识别。可识别印刷目录页以生成章节目录（按需 OCR）。
            </p>
            <p className="mt-0.5 text-xs text-amber-900/70 dark:text-amber-100/70">
              页码偏移：印刷页码 + 偏移 = PDF 页（例：印刷第 1 页在 PDF 第 13 页则填 12）。
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">扫描版 PDF，无嵌入目录</p>
            <p className="text-amber-900/80 dark:text-amber-100/80">
              划词划重点需先点工具栏「识别本页」。可识别印刷目录页以生成章节目录（按需 OCR）。
            </p>
            <p className="mt-0.5 text-xs text-amber-900/70 dark:text-amber-100/70">
              页码偏移：印刷页码 + 偏移 = PDF 页（例：印刷第 1 页在 PDF 第 13 页则填 12）。
            </p>
          </>
        )}
      </div>
      {mode !== 'recognizing' ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs">
            目录页
            <input
              type="number"
              min={1}
              className="w-14 rounded border border-amber-500/40 bg-background px-1.5 py-0.5 text-foreground"
              value={tocPageFrom}
              onChange={(e) => onTocPageFromChange(Number.parseInt(e.target.value, 10) || 1)}
            />
            –
            <input
              type="number"
              min={1}
              className="w-14 rounded border border-amber-500/40 bg-background px-1.5 py-0.5 text-foreground"
              value={tocPageTo}
              onChange={(e) => onTocPageToChange(Number.parseInt(e.target.value, 10) || 1)}
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            偏移
            <input
              type="number"
              min={0}
              className="w-14 rounded border border-amber-500/40 bg-background px-1.5 py-0.5 text-foreground"
              value={tocPageOffset}
              onChange={(e) => onTocPageOffsetChange(Number.parseInt(e.target.value, 10) || 0)}
              title="印刷页码 + 偏移 = PDF 页码"
            />
          </label>
          {onSuggestOffset ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={suggestingOffset}
              title="用目录标题去正文页找锚点，自动推算偏移"
              onClick={onSuggestOffset}
            >
              {suggestingOffset ? '推算中…' : '自动推算'}
            </Button>
          ) : null}
          {onDetectTocPages ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={detectingTocPages || busy}
              title="在文档前部低清扫描找目录页，只填入范围，需核对后手动识别"
              onClick={onDetectTocPages}
            >
              {detectingTocPages ? '查找中…' : '自动查找目录页'}
            </Button>
          ) : null}
          {extraActions}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onRecognize}
          >
            {recognizeLabel}
          </Button>
        </div>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0 text-amber-950 hover:bg-amber-500/20 dark:text-amber-100"
        aria-label="关闭提示"
        onClick={onDismiss}
      >
        <X />
      </Button>
    </div>
  )
}
