/**
 * 子目录 README 与实际文件一致性检查（AGENTS.md「子目录 README」规则的机器版本）。
 * Run: bun run lint:docs [repoRoot]
 *
 * 两项检查（仅扫描 src/ 与 electron/，与规则范围一致）：
 * A. 显式引用必须存在：README 中带源码/资源后缀的 `token`（如 `file-service.ts`）
 *    必须能解析到真实文件（README 所在目录优先，其次仓库根）。失败 → error。
 * B. 源码文件必须被收录：目录顶层 *.ts/*.tsx（不含 *.test.* 与 *.d.ts）须被同目录
 *    README 以精确名（含/不含后缀）或前缀模式（`epub-*`）覆盖。失败 → error。
 *    「见上级 README」式转交文档（含「见」+「README」）跳过 B（由上级按前缀覆盖）。
 *
 * 退出码：有 error 则非零。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? join(import.meta.dir, '..'))
const SCAN_SUBTREES = ['src', 'electron']
const SOURCE_EXTS = new Set(['.ts', '.tsx'])
const EXPLICIT_EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.ps1', '.css', '.html', '.md']
const SKIP_FILES = new Set(['README.md'])

/** 命名示例占位符（`PascalCase.tsx` 这类写法），不视为文件引用 */
const PLACEHOLDER_PATTERNS = [/pascalcase/i, /^use[A-Z*]/, /^(foo|bar|example)/i, /\*/]

function isPlaceholder(token: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(token))
}

function isTestOrDecl(file: string): boolean {
  return file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.d.ts')
}

function stripSourceExt(name: string): string {
  for (const ext of EXPLICIT_EXTS) {
    if (name.endsWith(ext)) return name.slice(0, -ext.length)
  }
  return name
}

function looksLikeFileToken(token: string): boolean {
  if (!token || token.length > 120) return false
  if (/[\s\u4e00-\u9fff]/.test(token)) return false
  if (token.includes('://')) return false
  if (!/^[A-Za-z0-9@_][\w@./-]*$/.test(token)) return false
  return true
}

function collectReadmes(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '.git') continue
    const stat = statSync(full)
    if (stat.isDirectory()) collectReadmes(full, out)
    else if (entry === 'README.md') out.push(full)
  }
  return out
}

function extractTokens(content: string): string[] {
  const tokens: string[] = []
  for (const match of content.matchAll(/`([^`\n]+)`/g)) {
    const token = match[1]!.trim()
    if (looksLikeFileToken(token)) tokens.push(token)
  }
  return tokens
}

let errors = 0
let warnings = 0

function reportError(readme: string, message: string): void {
  errors++
  console.error(`ERROR  ${relative(root, readme)}: ${message}`)
}

function reportWarning(readme: string, message: string): void {
  warnings++
  console.log(`WARN   ${relative(root, readme)}: ${message}`)
}

for (const subtree of SCAN_SUBTREES) {
  const base = join(root, subtree)
  if (!existsSync(base)) continue
  for (const readme of collectReadmes(base)) {
    const dir = dirname(readme)
    const content = readFileSync(readme, 'utf-8')
    const tokens = extractTokens(content)

    // A. 显式后缀引用必须存在（README 目录逐级上溯至仓库根均可，如 `main.tsx` 指 src/ 下）
    for (const token of tokens) {
      const lower = token.toLowerCase()
      const hasExplicitExt = EXPLICIT_EXTS.some((ext) => lower.endsWith(ext))
      if (!hasExplicitExt) continue
      if (isPlaceholder(token)) continue
      const candidates: string[] = []
      if (token.includes('/')) {
        candidates.push(join(dir, token))
        if (!token.startsWith('.')) candidates.push(join(root, token))
      } else {
        // 无路径前缀：从 README 所在目录逐级上溯到仓库根
        let current = dir
        while (true) {
          candidates.push(join(current, token))
          if (current === root) break
          const parent = dirname(current)
          if (parent === current) break
          current = parent
        }
      }
      if (!candidates.some((candidate) => existsSync(candidate) && statSync(candidate).isFile())) {
        reportError(readme, `引用不存在: \`${token}\``)
      }
    }

    // B. 顶层源码文件须被收录（转交式 README 跳过）
    if (/见/.test(content) && /README/.test(content)) continue
    const exact = new Set<string>()
    const prefixes: string[] = []
    for (const token of tokens) {
      if (token.endsWith('/')) continue
      if (token.includes('/')) {
        // 跨目录引用只取末段参与本目录覆盖判定
        const last = token.split('/').pop() ?? ''
        if (last) exact.add(stripSourceExt(last))
        continue
      }
      if (token.endsWith('*')) {
        prefixes.push(token.slice(0, -1))
        continue
      }
      if (token.endsWith('-')) {
        prefixes.push(token)
        continue
      }
      exact.add(stripSourceExt(token))
    }

    for (const entry of readdirSync(dir)) {
      if (SKIP_FILES.has(entry)) continue
      const full = join(dir, entry)
      if (!statSync(full).isFile()) continue
      const dot = entry.lastIndexOf('.')
      const ext = dot >= 0 ? entry.slice(dot) : ''
      if (!SOURCE_EXTS.has(ext)) continue
      if (isTestOrDecl(entry)) continue
      const baseName = basename(entry, ext)
      const covered = exact.has(entry) || exact.has(baseName) || prefixes.some((prefix) => baseName.startsWith(prefix))
      if (!covered) {
        reportError(readme, `源码未收录: \`${entry}\``)
      }
    }
  }
}

console.log(`\nlint:docs 完成：${errors} 个错误，${warnings} 个警告`)
process.exit(errors > 0 ? 1 : 0)
