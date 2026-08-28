import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { highlightSelectionMatches, search } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view'
import { applyScrollRatio, scrollRatio } from '@/lib/markdown-headings'
import type { AppTheme } from '@/stores/editor-ui-store'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'

export interface MarkdownEditorHandle {
  getView: () => EditorView | null
  getTopVisibleLine: () => number
  getLineScrollRatio: () => number
  scrollToLine: (line: number) => void
  scrollToLineRatio: (ratio: number) => void
  getScrollRatio: () => number
  setScrollRatio: (ratio: number) => void
  getScrollElement: () => HTMLElement | null
}

interface MarkdownEditorProps {
  value: string
  filePath?: string
  theme?: AppTheme
  onChange: (value: string) => void
  onScroll?: () => void
}

const themeCompartment = new Compartment()

function buildThemeExtensions(theme: AppTheme) {
  const isDark = theme === 'dark'

  return [
    syntaxHighlighting(isDark ? oneDarkHighlightStyle : defaultHighlightStyle, {
      fallback: true,
    }),
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '15px',
        backgroundColor: 'var(--editor)',
        color: isDark ? '#d4d4d4' : 'var(--foreground)',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineHeight: '1.65',
      },
      '.cm-content': {
        padding: '20px 0',
        caretColor: isDark ? '#7aa2f7' : 'var(--primary)',
      },
      '.cm-line': {
        padding: '0 20px',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: isDark ? '#7aa2f7' : 'var(--primary)',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        {
          backgroundColor: 'color-mix(in oklch, var(--primary) 35%, transparent)',
        },
      '.cm-gutters': {
        backgroundColor: 'var(--editor)',
        color: isDark ? '#6b7280' : 'var(--muted-foreground)',
        borderRight: '1px solid var(--border)',
        paddingRight: '4px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'color-mix(in oklch, var(--accent) 40%, transparent)',
        color: isDark ? '#d4d4d4' : 'var(--foreground)',
      },
      '.cm-activeLine': {
        backgroundColor: 'color-mix(in oklch, var(--accent) 25%, transparent)',
      },
      '.cm-foldGutter span': {
        color: isDark ? '#6b7280' : 'var(--muted-foreground)',
        cursor: 'pointer',
      },
      '.cm-placeholder': {
        color: isDark ? '#6b7280' : 'var(--muted-foreground)',
        fontStyle: 'italic',
      },
    }),
  ]
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, filePath, theme = 'dark', onChange, onScroll }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onScrollRef = useRef(onScroll)

    onChangeRef.current = onChange
    onScrollRef.current = onScroll

    useImperativeHandle(ref, () => ({
      getView: () => viewRef.current,
      getTopVisibleLine: () => {
        const view = viewRef.current
        if (!view) return 0

        const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop + 8)
        return view.state.doc.lineAt(block.from).number - 1
      },
      getLineScrollRatio: () => {
        const view = viewRef.current
        if (!view) return 0

        const totalLines = view.state.doc.lines
        if (totalLines <= 1) return 0

        const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop + 8)
        const visibleLine = view.state.doc.lineAt(block.from).number - 1
        return visibleLine / (totalLines - 1)
      },
      scrollToLine: (line) => {
        const view = viewRef.current
        if (!view) return

        const safeLine = Math.max(1, Math.min(view.state.doc.lines, line + 1))
        const lineInfo = view.state.doc.line(safeLine)
        view.dispatch({
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'start', yMargin: 16 }),
        })
        view.focus()
      },
      scrollToLineRatio: (ratio) => {
        const view = viewRef.current
        if (!view) return

        const totalLines = view.state.doc.lines
        if (totalLines <= 1) return

        const clamped = Math.max(0, Math.min(1, ratio))
        const targetLine = Math.round(clamped * (totalLines - 1))
        const lineInfo = view.state.doc.line(targetLine + 1)
        view.dispatch({
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'start', yMargin: 16 }),
        })
      },
      getScrollRatio: () => {
        const scroller = viewRef.current?.scrollDOM
        return scroller ? scrollRatio(scroller) : 0
      },
      setScrollRatio: (ratio) => {
        const scroller = viewRef.current?.scrollDOM
        if (scroller) applyScrollRatio(scroller, ratio)
      },
      getScrollElement: () => viewRef.current?.scrollDOM ?? null,
    }))

    useEffect(() => {
      if (!containerRef.current) return

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString())
        }
      })

      const state = EditorState.create({
        doc: value,
        extensions: [
          EditorState.tabSize.of(2),
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          indentOnInput(),
          bracketMatching(),
          foldGutter({
            openText: '▾',
            closedText: '▸',
          }),
          drawSelection(),
          dropCursor(),
          markdown({ base: markdownLanguage }),
          search({ top: false }),
          highlightSelectionMatches(),
          themeCompartment.of(buildThemeExtensions(theme)),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          placeholder('在此输入 Markdown 内容…'),
          updateListener,
          EditorView.lineWrapping,
        ],
      })

      const view = new EditorView({
        state,
        parent: containerRef.current,
      })

      viewRef.current = view

      const handleScroll = () => onScrollRef.current?.()
      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        view.scrollDOM.removeEventListener('scroll', handleScroll)
        view.destroy()
        viewRef.current = null
      }
    }, [])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return

      view.dispatch({
        effects: themeCompartment.reconfigure(buildThemeExtensions(theme)),
      })
    }, [theme])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return

      const current = view.state.doc.toString()
      if (value === current) return

      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }, [value])

    useEffect(() => {
      if (!filePath) return
      viewRef.current?.focus()
    }, [filePath])

    return <div ref={containerRef} className="h-full min-h-0 bg-editor" />
  },
)
