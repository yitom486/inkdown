import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { err, isOk } from '@shared/core/result'
import { rosettaApi } from '@/api/rosetta-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BOOK_SEARCH_LIMIT,
  BookSearchSession,
  formatBookSearchHeading,
  toBookSearchKeyword,
} from '@/lib/reader/pdf-book-search'

/**
 * PDF 正文词语搜索（P0.1）：工具栏紧凑触发按钮 + 独立浮层。
 *
 * 只读复用 `queryBook(kind='search')`；短词不请求；输入改变立即清空旧结果
 * （旧词结果不得伪装成新词结果）；后发覆盖先发；展示数（≤20）不冒充总数；
 * 点击结果跳页并关闭浮层。
 */
export function PdfBookSearch({
  fingerprint,
  indexed,
  onJumpToPage,
}: {
  /** 当前打开 PDF 的罗盘指纹；切换文件即失效旧状态 */
  fingerprint: string
  /** false 时禁用并提示先建立罗盘索引 */
  indexed: boolean
  /** 现有阅读器跳页路径 */
  onJumpToPage: (page: number) => void
}): React.JSX.Element {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [, setTick] = useState(0)
  const sessionRef = useRef<BookSearchSession | null>(null)
  if (!sessionRef.current) {
    sessionRef.current = new BookSearchSession(async (fp, keyword) => {
      const result = await rosettaApi.queryBook({
        kind: 'search',
        fingerprint: fp,
        keyword,
        limit: BOOK_SEARCH_LIMIT,
      })
      if (!isOk(result) || result.value.kind !== 'search') {
        return err({ code: 'UNKNOWN', message: !isOk(result) ? result.error.message : '搜索失败' })
      }
      return { ok: true as const, value: result.value.blocks }
    })
  }
  const session = sessionRef.current

  useEffect(() => session.subscribe(() => setTick((tick) => tick + 1)), [session])
  // 文件切换：清空关键词/结果/错误/pending（旧异步回写按代际丢弃）
  useEffect(() => {
    setInput('')
    setOpen(false)
    session.bind(fingerprint)
  }, [fingerprint, session])

  const state = session.getState()
  const keywordValid = toBookSearchKeyword(input) !== null
  const disabled = !indexed

  const close = (): void => {
    session.reset()
    setOpen(false)
  }

  const submit = (): void => {
    if (disabled) return
    // 短词拒绝不请求；面板保持打开，原地展示“至少输入 3 个字符”
    session.search(input)
  }

  const handleInputChange = (value: string): void => {
    setInput(value)
    // 输入一变就清旧结果（面板保持打开）：旧词结果不得伪装成新词结果，
    // pending 一并作废；idle 时无旧状态可清，直接返回
    if (session.getState().status !== 'idle') {
      session.reset()
    }
  }

  const hint = useMemo(() => {
    if (disabled) return '先建立罗盘索引'
    if (!keywordValid && input.trim()) return '至少输入 3 个字符'
    return ''
  }, [disabled, keywordValid, input])

  return (
    <span className="relative flex items-center">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={disabled}
        title={disabled ? '先建立罗盘索引' : '搜索正文'}
        aria-label="搜索正文"
        onClick={() => setOpen((value) => !value)}
      >
        <Search className="size-4" aria-hidden />
      </Button>
      {open && !disabled ? (
        <div className="absolute right-0 top-8 z-50 w-96 rounded-md border bg-popover p-2 shadow-md">
          <div className="flex items-center gap-1">
            <Input
              value={input}
              placeholder="搜索正文"
              aria-label="搜索正文关键词"
              className="h-7 text-xs"
              autoFocus
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
                if (event.key === 'Escape') close()
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 gap-1 text-xs"
              disabled={!keywordValid}
              title="搜索正文（至少 3 个字符）"
              onClick={submit}
            >
              {state.status === 'loading' ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              搜索
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 shrink-0 text-xs"
              onClick={close}
            >
              关闭
            </Button>
          </div>
          {hint ? <p className="px-1 pt-1 text-xs text-muted-foreground">{hint}</p> : null}
          <div className="max-h-80 overflow-auto pt-1">
            <p className="px-1 pb-1 text-xs text-muted-foreground">最多显示 {BOOK_SEARCH_LIMIT} 条</p>
            {state.status === 'loading' ? <p className="px-1 py-2 text-xs">搜索中…</p> : null}
            {state.status === 'empty' ? <p className="px-1 py-2 text-xs">未命中</p> : null}
            {state.status === 'error' ? (
              <p className="px-1 py-2 text-xs text-destructive">{state.error || '搜索失败'}</p>
            ) : null}
            {state.status === 'done'
              ? state.items.map((item) => (
                  <button
                    key={item.blockId}
                    type="button"
                    className="block w-full rounded px-1 py-1.5 text-left hover:bg-accent"
                    onClick={() => {
                      onJumpToPage(item.pageNumber)
                      close()
                    }}
                  >
                    <span className="block text-xs font-medium">
                      {formatBookSearchHeading(item.chapterTitle, item.pageNumber)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{item.excerpt}</span>
                  </button>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </span>
  )
}
