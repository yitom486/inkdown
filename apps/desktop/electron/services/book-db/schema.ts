import type { DatabaseSync } from 'node:sqlite'

/**
 * 罗盘索引 schema（单书一库）。
 * books/chapters/blocks + trigram FTS；blocks.id 为 INTEGER rowid，
 * FTS 外部内容表才能用 content_rowid 挂接。
 */

export const BOOK_DB_SCHEMA_VERSION = 4

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_path TEXT NOT NULL,
  format TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  page_offset INTEGER NOT NULL DEFAULT 0,
  clean_version TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  level INTEGER NOT NULL,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  UNIQUE (book_id, chapter_index)
);
CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  chapter_index INTEGER NOT NULL,
  block_index INTEGER NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  bbox TEXT,
  confidence REAL,
  UNIQUE (book_id, chapter_index, block_index)
);
CREATE INDEX IF NOT EXISTS idx_blocks_book_page ON blocks (book_id, page_number);
CREATE VIRTUAL TABLE IF NOT EXISTS block_fts USING fts5(
  content,
  content='blocks',
  content_rowid='id',
  tokenize='trigram'
);
CREATE TRIGGER IF NOT EXISTS blocks_ai AFTER INSERT ON blocks BEGIN
  INSERT INTO block_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS blocks_ad AFTER DELETE ON blocks BEGIN
  INSERT INTO block_fts(block_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS blocks_au AFTER UPDATE ON blocks BEGIN
  INSERT INTO block_fts(block_fts, rowid, content) VALUES ('delete', old.id, old.content);
  INSERT INTO block_fts(rowid, content) VALUES (new.id, new.content);
END;
`

const MIGRATIONS: Record<number, string> = {
  1: MIGRATION_V1,
  // v2：books.completed_pages 记录已完成 OCR+入库的页（含空页），崩溃/取消后续跑
  2: `ALTER TABLE books ADD COLUMN completed_pages TEXT NOT NULL DEFAULT '[]';`,
  // v3：books.toc_signature（目录签名，缺省 ''=未重建）+ toc_entries 全量目录项。
  // 前向兼容：只新增列/表，不改旧列语义；旧代码忽略新表仍可读写 books/chapters/blocks。
  3: `ALTER TABLE books ADD COLUMN toc_signature TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS toc_entries (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  toc_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  level INTEGER NOT NULL,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  UNIQUE (book_id, toc_index)
);
CREATE INDEX IF NOT EXISTS idx_toc_entries_book ON toc_entries (book_id, toc_index);`,
  // v4：blocks.source（native/ocr/unknown）+ extract_version（提取管线版本）。
  // 旧行回填启发式：有 bbox 即有过 span 对齐 → ocr，否则 native。
  // 注意：bbox 为空的表格块会被标 native（旧库无法区分，属已知近似；新行写入时准确）。
  4: `ALTER TABLE blocks ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE blocks ADD COLUMN extract_version TEXT NOT NULL DEFAULT '';
UPDATE blocks SET source = CASE WHEN bbox IS NULL THEN 'native' ELSE 'ocr' END;`,
}

export function getBookDbVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: unknown } | undefined
  const version = row?.user_version
  return typeof version === 'number' && Number.isInteger(version) ? version : 0
}

/** 按 user_version 顺序执行缺失迁移；幂等，可重复调用 */
export function migrateBookDb(db: DatabaseSync): { migrated: boolean; version: number } {
  // 文件库 WAL 并发读；:memory: 下此语句无害
  try {
    db.exec('PRAGMA journal_mode = WAL')
  } catch {
    // 极早版本驱动不支持时忽略，迁移本身不受影响
  }
  const current = getBookDbVersion(db)
  const pending = Object.keys(MIGRATIONS)
    .map(Number)
    .filter((version) => version > current)
    .sort((a, b) => a - b)
  for (const version of pending) {
    const sql = MIGRATIONS[version]
    if (!sql) continue
    db.exec(sql)
    db.exec(`PRAGMA user_version = ${version}`)
  }
  const next = pending.length > 0 ? (pending[pending.length - 1] as number) : current
  return { migrated: pending.length > 0, version: next }
}
