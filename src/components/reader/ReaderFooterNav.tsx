import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReaderNavTitles } from '@/stores/reader-navigation-store'

interface ReaderFooterNavProps {
  ready?: boolean
  onPrevious?: () => void
  onNext?: () => void
}

export function ReaderFooterNav({
  ready = true,
  onPrevious,
  onNext,
}: ReaderFooterNavProps) {
  const {
    currentTitle,
    previousTitle,
    nextTitle,
    previousDisabled,
    nextDisabled,
  } = useReaderNavTitles()

  return (
    <footer className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border/60 bg-sidebar px-3 py-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-auto min-h-9 justify-start gap-1 px-2 py-1.5 text-left"
        disabled={!ready || previousDisabled}
        onClick={onPrevious}
      >
        <ChevronLeft className="size-4 shrink-0" />
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            上一节
          </span>
          <span className="block truncate text-xs">{previousTitle}</span>
        </span>
      </Button>

      <div className="px-2 text-center">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          当前节
        </span>
        <span className="block max-w-40 truncate text-xs font-medium">{currentTitle}</span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-auto min-h-9 justify-end gap-1 px-2 py-1.5 text-right"
        disabled={!ready || nextDisabled}
        onClick={onNext}
      >
        <span className="min-w-0">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            下一节
          </span>
          <span className="block truncate text-xs">{nextTitle}</span>
        </span>
        <ChevronRight className="size-4 shrink-0" />
      </Button>
    </footer>
  )
}
