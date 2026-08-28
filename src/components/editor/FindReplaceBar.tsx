import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Replace, X } from 'lucide-react'
import {
  SearchQuery,
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  setSearchQuery,
} from '@codemirror/search'
import type { EditorView } from '@codemirror/view'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FindReplaceBarProps {
  open: boolean
  mode: 'find' | 'replace'
  editorView: EditorView | null
  onClose: () => void
}

export function FindReplaceBar({ open, mode, editorView, onClose }: FindReplaceBarProps) {
  const findInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [searchText, setSearchText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCount, setMatchCount] = useState<number | null>(null)

  const applyQuery = useCallback(
    (search: string, replace: string) => {
      if (!editorView) return null

      const query = new SearchQuery({
        search,
        replace,
        caseSensitive: false,
        regexp: false,
        wholeWord: false,
      })

      editorView.dispatch({ effects: setSearchQuery.of(query) })
      return query
    },
    [editorView],
  )

  const refreshMatchCount = useCallback(
    (search: string, replace: string) => {
      applyQuery(search, replace)

      if (!editorView || !search) {
        setMatchCount(null)
        return
      }

      const text = editorView.state.doc.toString()
      let count = 0
      let pos = 0
      while (pos <= text.length) {
        const index = text.indexOf(search, pos)
        if (index === -1) break
        count += 1
        pos = index + Math.max(1, search.length)
      }
      setMatchCount(count)
    },
    [applyQuery, editorView],
  )

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      findInputRef.current?.focus()
      findInputRef.current?.select()
    })
  }, [open, mode])

  useEffect(() => {
    if (!open) return
    refreshMatchCount(searchText, replaceText)
  }, [open, refreshMatchCount, replaceText, searchText])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  const runFindNext = () => {
    if (!editorView) return
    applyQuery(searchText, replaceText)
    findNext(editorView)
  }

  const runFindPrevious = () => {
    if (!editorView) return
    applyQuery(searchText, replaceText)
    findPrevious(editorView)
  }

  const runReplaceNext = () => {
    if (!editorView) return
    applyQuery(searchText, replaceText)
    replaceNext(editorView)
    refreshMatchCount(searchText, replaceText)
  }

  const runReplaceAll = () => {
    if (!editorView) return
    applyQuery(searchText, replaceText)
    replaceAll(editorView)
    refreshMatchCount(searchText, replaceText)
  }

  return (
    <div
      className="absolute right-3 top-3 z-20 w-[min(100%-1.5rem,28rem)] rounded-lg border border-border bg-popover p-3 shadow-lg"
      role="search"
      aria-label={mode === 'replace' ? '查找替换' : '查找'}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {mode === 'replace' ? '查找与替换' : '查找'}
        </p>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="关闭" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            ref={findInputRef}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (event.shiftKey) {
                  runFindPrevious()
                } else {
                  runFindNext()
                }
              }
            }}
            placeholder="查找内容"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <Button type="button" variant="outline" size="icon-xs" title="上一个" onClick={runFindPrevious}>
            <ChevronUp />
          </Button>
          <Button type="button" variant="outline" size="icon-xs" title="下一个" onClick={runFindNext}>
            <ChevronDown />
          </Button>
        </div>

        {mode === 'replace' && (
          <input
            ref={replaceInputRef}
            value={replaceText}
            onChange={(event) => setReplaceText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                runReplaceNext()
              }
            }}
            placeholder="替换为"
            className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {searchText
            ? matchCount === 0
              ? '无匹配'
              : `共 ${matchCount} 处匹配`
            : 'Ctrl+Enter 查找下一处'}
        </span>
        <div className="flex items-center gap-1.5">
          {mode === 'replace' && (
            <>
              <Button type="button" variant="outline" size="xs" onClick={runReplaceNext} disabled={!searchText}>
                替换
              </Button>
              <Button type="button" variant="outline" size="xs" onClick={runReplaceAll} disabled={!searchText}>
                全部
              </Button>
            </>
          )}
          <Button
            type="button"
            size="xs"
            className={cn(mode === 'find' && 'ml-auto')}
            onClick={runFindNext}
            disabled={!searchText}
          >
            查找
          </Button>
        </div>
      </div>

      {mode === 'replace' && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Replace className="size-3" />
          Ctrl+H 打开替换面板
        </p>
      )}
    </div>
  )
}
