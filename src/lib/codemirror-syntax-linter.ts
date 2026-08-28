import { linter, lintGutter } from '@codemirror/lint'
import type { Diagnostic } from '@codemirror/lint'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNodeRef } from '@lezer/common'
import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

const OPEN_TO_CLOSE: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
}

/** 在无语言标记的代码块内检查括号是否配对 */
export function findUnbalancedBrackets(text: string, offset: number): Diagnostic[] {
  const stack: { char: string; pos: number }[] = []
  const diagnostics: Diagnostic[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (!ch) continue

    if (ch in OPEN_TO_CLOSE) {
      stack.push({ char: ch, pos: i })
      continue
    }

    const expectedOpen =
      ch === ')' ? '(' : ch === ']' ? '[' : ch === '}' ? '{' : null
    if (!expectedOpen) continue

    const top = stack[stack.length - 1]
    if (!top || top.char !== expectedOpen) {
      diagnostics.push({
        from: offset + i,
        to: offset + i + 1,
        severity: 'error',
        message: `多余的 '${ch}'`,
        source: 'brackets',
      })
      continue
    }

    stack.pop()
  }

  for (const item of stack) {
    diagnostics.push({
      from: offset + item.pos,
      to: offset + item.pos + 1,
      severity: 'warning',
      message: `'${item.char}' 未闭合`,
      source: 'brackets',
    })
  }

  return diagnostics
}

function fencedCodeHasLanguage(state: EditorState, from: number, to: number): boolean {
  const doc = state.doc.toString()
  let hasLanguage = false

  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      if (node.name !== 'CodeInfo') return
      if (doc.slice(node.from, node.to).trim()) {
        hasLanguage = true
      }
    },
  })

  return hasLanguage
}

function isLeafErrorNode(ref: SyntaxNodeRef): boolean {
  if (!ref.type.isError) return false
  for (let child = ref.node.firstChild; child; child = child.nextSibling) {
    if (child.type.isError) return false
  }
  return true
}

function collectDiagnostics(view: EditorView): Diagnostic[] {
  try {
    const diagnostics: Diagnostic[] = []
    const state = view.state
    const doc = state.doc.toString()

    syntaxTree(state).iterate({
      enter(node) {
        if (isLeafErrorNode(node)) {
          diagnostics.push({
            from: node.from,
            to: Math.max(node.from + 1, node.to),
            severity: 'error',
            message: '语法错误（可能存在未闭合的括号或非法符号）',
            source: 'syntax',
          })
          return
        }

        if (node.name !== 'CodeText') return

        const parent = node.node.parent
        if (!parent || parent.name !== 'FencedCode') return
        if (fencedCodeHasLanguage(state, parent.from, parent.to)) return

        const code = doc.slice(node.from, node.to)
        diagnostics.push(...findUnbalancedBrackets(code, node.from))
      },
    })

    return diagnostics
  } catch (error) {
    console.error('[markdownSyntaxLinter]', error)
    return []
  }
}

/** 解析器语法错误 + 无语言标记代码块的括号检查 */
export function markdownSyntaxLinter() {
  return linter((view) => collectDiagnostics(view), { delay: 300 })
}

export function markdownLintGutter() {
  return lintGutter()
}
