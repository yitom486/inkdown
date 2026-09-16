import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { ReadingProgressSnapshot } from './mergers/progress-merger'

function getProgressFilePath(): string {
  return join(app.getPath('userData'), 'reading-progress.json')
}

export async function readLocalProgress(): Promise<ReadingProgressSnapshot> {
  const filePath = getProgressFilePath()
  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as ReadingProgressSnapshot
    return parsed ?? {}
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {}
    }
    return {}
  }
}

export async function writeLocalProgress(snapshot: ReadingProgressSnapshot): Promise<void> {
  const filePath = getProgressFilePath()
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8')
}
