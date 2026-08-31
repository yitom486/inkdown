import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface WebDocAddressBarProps {
  pageUrl: string
  recentUrls?: string[]
  onNavigate: (url: string) => void
}

export function WebDocAddressBar({
  pageUrl,
  recentUrls = [],
  onNavigate,
}: WebDocAddressBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(pageUrl)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(pageUrl)
  }, [focused, pageUrl])

  const submit = () => {
    const value = draft.trim()
    if (!value) return
    onNavigate(value)
    inputRef.current?.blur()
  }

  const otherRecent = recentUrls.filter((url) => url !== pageUrl)

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        value={draft}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        onFocus={() => {
          setFocused(true)
          inputRef.current?.select()
        }}
        onBlur={() => setFocused(false)}
        className={cn(
          'h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-xs',
          'shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        )}
        placeholder="https://"
        spellCheck={false}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
          if (event.key === 'Escape') {
            setDraft(pageUrl)
            inputRef.current?.blur()
          }
        }}
      />
      <Button type="button" variant="secondary" size="sm" className="h-7 px-2.5 text-xs" onClick={submit}>
        前往
      </Button>
      {otherRecent.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 shrink-0"
              title="最近打开的文档"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-md">
            <DropdownMenuLabel>最近在线文档</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {otherRecent.map((url) => (
              <DropdownMenuItem key={url} className="max-w-md truncate" title={url} onClick={() => onNavigate(url)}>
                {url}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
