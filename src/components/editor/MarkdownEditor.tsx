import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { useEffect, useRef } from 'react'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)

  onChangeRef.current = onChange

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
        lineNumbers(),
        highlightActiveLine(),
        history(),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        updateListener,
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          },
          '.cm-content': {
            padding: '16px 0',
          },
          '.cm-gutters': {
            backgroundColor: 'transparent',
            borderRight: '1px solid var(--border)',
          },
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const current = view.state.doc.toString()
    if (value === current) return

    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    })
  }, [value])

  return <div ref={containerRef} className="h-full min-h-0 bg-background" />
}
