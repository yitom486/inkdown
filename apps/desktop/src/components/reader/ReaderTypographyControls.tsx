import { Minus, Plus, Rows3, Type } from 'lucide-react'
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
import {
  READER_FONT_SIZE_OPTIONS,
  READER_LINE_HEIGHT_OPTION_LABELS,
  useAppSettingsStore,
  type ReaderFontSize,
  type ReaderLineHeight,
} from '@/stores/app-settings-store'

interface ReaderTypographyControlsProps {
  disabled?: boolean
}

function nextFontSize(current: ReaderFontSize, direction: -1 | 1): ReaderFontSize {
  const index = READER_FONT_SIZE_OPTIONS.indexOf(current)
  const nextIndex = Math.min(READER_FONT_SIZE_OPTIONS.length - 1, Math.max(0, index + direction))
  return READER_FONT_SIZE_OPTIONS[nextIndex]!
}

/** EPUB / MOBI / AZW3 共享的顶部阅读排版控制；值持久化在应用设置中。 */
export function ReaderTypographyControls({ disabled = false }: ReaderTypographyControlsProps) {
  const fontSize = useAppSettingsStore((state) => state.readerFontSize)
  const lineHeight = useAppSettingsStore((state) => state.readerLineHeight)
  const setFontSize = useAppSettingsStore((state) => state.setReaderFontSize)
  const setLineHeight = useAppSettingsStore((state) => state.setReaderLineHeight)
  const minimum = fontSize === READER_FONT_SIZE_OPTIONS[0]
  const maximum = fontSize === READER_FONT_SIZE_OPTIONS[READER_FONT_SIZE_OPTIONS.length - 1]

  return (
    <div className="flex items-center gap-0.5 border-r border-border/60 pr-2">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        disabled={disabled || minimum}
        title="减小字号"
        aria-label="减小字号"
        onClick={() => setFontSize(nextFontSize(fontSize, -1))}
      >
        <Minus className="size-3.5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 text-xs tabular-nums"
            disabled={disabled}
            title="阅读排版"
          >
            <Type className="size-3.5" />
            {fontSize}px
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuLabel className="text-[10px] text-muted-foreground">正文大小</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={String(fontSize)} onValueChange={(value) => setFontSize(Number(value) as ReaderFontSize)}>
            {READER_FONT_SIZE_OPTIONS.map((value) => (
              <DropdownMenuRadioItem key={value} value={String(value)} className="text-xs">
                {value}px
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] text-muted-foreground">行距</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={String(lineHeight)} onValueChange={(value) => setLineHeight(Number(value) as ReaderLineHeight)}>
            {READER_LINE_HEIGHT_OPTION_LABELS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={String(option.value)} className="text-xs">
                <Rows3 className="size-3.5" />
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        disabled={disabled || maximum}
        title="增大字号"
        aria-label="增大字号"
        onClick={() => setFontSize(nextFontSize(fontSize, 1))}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}
