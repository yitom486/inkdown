import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import type { AppTheme } from '@shared/types/editor'

export function buildThemeExtensions(theme: AppTheme, fontSize: number) {
  const isDark = theme === 'dark'

  return [
    syntaxHighlighting(isDark ? oneDarkHighlightStyle : defaultHighlightStyle, {
      fallback: true,
    }),
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: `${fontSize}px`,
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
      '.cm-lintRange-error': {
        backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='m0 3 l2 -2 l1 0 l2 2 l1 0' fill='%23ef4444' /></svg>")`,
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'left bottom',
      },
      '.cm-lintRange-warning': {
        backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='m0 3 l2 -2 l1 0 l2 2 l1 0' fill='%23f59e0b' /></svg>")`,
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'left bottom',
      },
      '.cm-gutter-lint': {
        width: '1em',
      },
      '.cm-gutter-lint .cm-lintMarker-error': {
        content: '"●"',
        color: '#ef4444',
      },
      '.cm-gutter-lint .cm-lintMarker-warning': {
        content: '"●"',
        color: '#f59e0b',
      },
    }),
  ]
}
