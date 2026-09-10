import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * PDF 工具栏“更多工具”：低频单次操作收进下拉菜单，工具栏只留导航、
 * 搜索、状态徽章与本菜单触发器，避免窄窗下控件互相挤压重叠。
 */

export interface PdfToolbarMenuItem {
  key: string
  label: string
  title?: string
  disabled?: boolean
  onSelect: () => void
}

export function PdfToolbarMoreMenu({ items }: { items: readonly PdfToolbarMenuItem[] }) {
  if (items.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          title="更多工具"
          aria-label="更多工具"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            title={item.title}
            disabled={item.disabled}
            onSelect={() => item.onSelect()}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type PdfIndexBadge = 'running' | 'ready' | 'stale' | 'unindexed-scanned' | 'hidden'

/**
 * 罗盘徽章状态（纯函数）：未入库提示仅扫描版 PDF 才有（扫描版不建索引
 * 则 Agent/搜索无库可用，是真正必要的提示）；EPUB 等其他格式不提示，
 * 是否入库由用户自己选择。导入进行中优先显示进度。
 */
export function resolvePdfIndexBadge(input: {
  hasFingerprint: boolean
  importRunning: boolean
  indexed: boolean
  tocStale: boolean
  isScannedPdf: boolean
}): PdfIndexBadge {
  if (!input.hasFingerprint) return 'hidden'
  if (input.importRunning) return 'running'
  if (!input.indexed) return input.isScannedPdf ? 'unindexed-scanned' : 'hidden'
  return input.tocStale ? 'stale' : 'ready'
}
