import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import cpp from 'highlight.js/lib/languages/cpp'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  yml: 'yaml',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  md: 'markdown',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  c: 'cpp',
  h: 'cpp',
  'c++': 'cpp',
  text: 'plaintext',
  plaintext: 'plaintext',
}

const REGISTERED = new Set<string>()

function registerLanguage(name: string, setup: unknown) {
  if (REGISTERED.has(name)) return

  const languageFn =
    typeof setup === 'function'
      ? setup
      : (setup as { default: (hljs: typeof import('highlight.js').default) => unknown }).default

  hljs.registerLanguage(name, languageFn as Parameters<typeof hljs.registerLanguage>[1])
  REGISTERED.add(name)
}

registerLanguage('typescript', typescript)
registerLanguage('javascript', javascript)
registerLanguage('json', json)
registerLanguage('bash', bash)
registerLanguage('python', python)
registerLanguage('css', css)
registerLanguage('xml', xml)
registerLanguage('markdown', markdown)
registerLanguage('yaml', yaml)
registerLanguage('sql', sql)
registerLanguage('rust', rust)
registerLanguage('go', go)
registerLanguage('java', java)
registerLanguage('cpp', cpp)
registerLanguage('plaintext', plaintext)

export function normalizeHighlightLanguage(language: string): string {
  const lower = language.trim().toLowerCase()
  if (!lower) return 'plaintext'
  return LANGUAGE_ALIASES[lower] ?? lower
}

export function highlightCode(code: string, language: string): string {
  const normalized = normalizeHighlightLanguage(language)

  if (normalized !== 'plaintext' && hljs.getLanguage(normalized)) {
    return hljs.highlight(code, { language: normalized }).value
  }

  if (code.trim()) {
    return hljs.highlightAuto(code).value
  }

  return hljs.highlight(code, { language: 'plaintext' }).value
}

export { hljs }
