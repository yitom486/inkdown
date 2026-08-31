import type { ReactNode } from 'react'
import { Bookmark, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReaderNavTitles } from '@/stores/reader-navigation-store'

interface ReaderToolbarShellProps {
  ready?: boolean
  tocDisabled?: boolean
  marksHidden?: boolean
  onTocToggle: () => void
  onMarksToggle: () => void
  onAddBookmark: () => void
  addBookmarkDisabled?: boolean
  center?: ReactNode
  trailing?: ReactNode
}

export function ReaderToolbarShell({
  ready = true,
  tocDisabled = false,
  marksHidden = false,
  onTocToggle,
  onMarksToggle,
  onAddBookmark,
  addBookmarkDisabled = false,
  center,
  trailing,
}: ReaderToolbarShellProps) {
  const { currentTitle } = useReaderNavTitles()

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-3 py-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs"
        disabled={!ready || tocDisabled}
        onClick={onTocToggle}
      >
        <List className="size-3.5" />
        目录
      </Button>
      {!marksHidden ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={!ready}
            onClick={onMarksToggle}
          >
            <Bookmark className="size-3.5" />
            书签与批注
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={!ready || addBookmarkDisabled}
            onClick={onAddBookmark}
          >
            添加书签
          </Button>
        </>
      ) : null}
      <span className="ml-2 min-w-0 truncate text-xs text-muted-foreground">{currentTitle}</span>
      {center ? <div className="flex min-w-0 flex-1 items-center justify-center gap-1">{center}</div> : null}
      {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  )
}
