import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { err, isOk } from '@shared/core/result'
import { rosettaApi } from '@/api/rosetta-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BOOK_SEARCH_LIMIT,
  BookSearchSession,
  toBookSearchKeyword,
} from '@/lib/reader/pdf-book-search'

/**
 * PDF 正文词语搜索（P0.1）：当前已入库书的手动检索入口。
 *
 * 只读复用 `queryBook(kind='search')`；短词不请求；后发覆盖先发；
 * 展示数（≤20）不冒充全书总数；点击结果跳页并关闭面板。
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

  const submit = (): void => {
    if (disabled) return
    const { accepted } = session.search(input)
    // 短词拒绝不请求：面板保持关闭，输入框下方给出提示
    setOpen(accepted)
  }

  const hint = useMemo(() => {
    if (disabled) return '先建立罗盘索引'
    if (!keywordValid && input.trim()) return '至少输入 3 个字符'
    return ''
  }, [disabled, keywordValid, input])

  return (
    <span className="relative flex items-center gap-1">
      <Input
        value={input}
        disabled={disabled}
        placeholder="搜索正文"
        aria-label="搜索正文"
        className="h-7 w-36 text-xs"
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 gap-1 text-xs"
        disabled={disabled || !keywordValid}
        title={disabled ? '先建立罗盘索引' : '搜索正文（至少 3 个字符）'}
        onClick={submit}
      >
        {state.status === 'loading' ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Search className="size-3.5" aria-hidden />
        )}
        搜索
      </Button>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {open && !disabled ? (
        <div className="absolute right-0 top-8 z-50 max-h-80 w-96 overflow-auto rounded-md border bg-popover p-2 shadow-md">
          <div className="flex items-center justify-between px-1 pb-1 text-xs text-muted-foreground">
            <span>最多显示 {BOOK_SEARCH_LIMIT} 条</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => {
                session.reset()
                setOpen(false)
              }}
            >
              关闭
            </Button>
          </div>
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
                    session.reset()
                    setOpen(false)
                  }}
                >
                  <span className="block text-xs font-medium">
                    {item.chapterTitle ?? `第 ${item.pageNumber} 页`}
                    <span className="ml-1 font-normal text-muted-foreground">
                      第 {item.pageNumber} 页
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{item.excerpt}</span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </span>
  )
}
