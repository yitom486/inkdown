/** 从 CHANGELOG.md 提取指定 tag 对应的 GitHub Release 正文。 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const CHANGELOG = join(ROOT, 'CHANGELOG.md')

export function releaseVersionFromTag(tag: string): string {
  const match = /^v(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/.exec(tag.trim())
  if (!match) {
    throw new Error(`release-notes: tag 必须是 vX.Y.Z 格式，实际为：${tag}`)
  }
  return match[1]
}

export function extractReleaseNotes(changelog: string, tag: string): string {
  const version = releaseVersionFromTag(tag)
  const heading = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\](?:\\s*-.*)?\\s*$`, 'm')
  const match = heading.exec(changelog)
  if (!match || match.index === undefined) {
    throw new Error(`release-notes: CHANGELOG.md 找不到 [${version}] 对应的版本节`)
  }

  const bodyStart = match.index + match[0].length
  const nextHeading = /^## \[/m
  nextHeading.lastIndex = bodyStart
  const next = nextHeading.exec(changelog.slice(bodyStart))
  const body = changelog
    .slice(bodyStart, next ? bodyStart + next.index : undefined)
    .replace(/^\s*\n/, '')
    .replace(/\n---\s*$/m, '')
    .trim()

  if (!body) {
    throw new Error(`release-notes: [${version}] 版本节没有可发布的内容`)
  }
  return `## ${tag}\n\n${body}\n`
}

function main(): void {
  const [tag, outputPath] = process.argv.slice(2)
  if (!tag || !outputPath) {
    throw new Error('用法: bun run scripts/release-notes.ts <tag> <output-path>')
  }
  const changelog = readFileSync(CHANGELOG, 'utf-8')
  writeFileSync(outputPath, extractReleaseNotes(changelog, tag), 'utf-8')
}

if (import.meta.main) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
