import type { EditorView } from '@codemirror/view'
import { applyLinkTemplate, buildLinkTemplate, wrapRangeText } from '@/lib/markdown-editing'

export function wrapMarkdownMarkers(view: EditorView, before: string, after: string): boolean {
  const range = view.state.selection.main
  const current = view.state.doc.toString()
  const selected = current.slice(range.from, range.to)
  const insert = range.from === range.to ? `${before}${after}` : `${before}${selected}${after}`
  const result = wrapRangeText(current, { from: range.from, to: range.to }, before, after)

  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: result.selection.from, head: result.selection.to },
  })
  view.focus()
  return true
}

export function insertMarkdownLink(view: EditorView): boolean {
  const range = view.state.selection.main
  const current = view.state.doc.toString()
  const selected = current.slice(range.from, range.to)
  const { insert } = buildLinkTemplate(selected)
  const result = applyLinkTemplate(current, { from: range.from, to: range.to })

  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: result.selection.from, head: result.selection.to },
  })
  view.focus()
  return true
}

export const markdownFormattingKeymap = [
  { key: 'Mod-b', run: (view: EditorView) => wrapMarkdownMarkers(view, '**', '**') },
  { key: 'Mod-i', run: (view: EditorView) => wrapMarkdownMarkers(view, '*', '*') },
  { key: 'Mod-k', run: (view: EditorView) => insertMarkdownLink(view) },
]
