import type { DatabaseSync } from 'node:sqlite'

/**
 * 罗盘索引 schema（单书一库）。
 * books/chapters/blocks + trigram FTS；blocks.id 为 INTEGER rowid，
 * FTS 外部内容表才能用 content_rowid 挂接。
 * v5 新增 marks（卡片住本书库，见 .plan/marks-sqlite/01）：marks.id 为 TEXT 主键，
 * 但 SQLite 表恒有隐式 rowid，marks_fts 挂 content_rowid='rowid' 照样成立。
 */

export const BOOK_DB_SCHEMA_VERSION = 5

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
  // v5：marks（卡片搬迁，[2]-01）。anchor 双份：anchor_json 保真 blob，
  // 抽取列供查。chapter_key 是主联动键（ChapterKey 品牌值，创建时固化优先，
  // 见 .plan/marks-sqlite/01）；chapter_id 整数外键只在能对上 chapters 行时
  // 回填（chapters 表无 key 列，01 期恒为 NULL，不阻塞主链路）。
  // chapter_json 原样保留 MarkChapterRef（含 label/index），保证导出 round-trip。
  // marks_tombstones 供同步合并（mergeReadingMarks 的 tombstones 在此落盘）。
  // flashcards/review_log 留给 02（v6），不在本期。
  5: `CREATE TABLE IF NOT EXISTS marks (
  id TEXT PRIMARY KEY,
  file_fingerprint TEXT NOT NULL,
  file_path TEXT NOT NULL,
  kind TEXT NOT NULL,
  category TEXT,
  title TEXT,
  label TEXT,
  note TEXT,
  excerpt TEXT,
  ai_summary TEXT,
  key_points TEXT,
  tags TEXT,
  color TEXT,
  collapsed INTEGER NOT NULL DEFAULT 0,
  diagram_id TEXT,
  anchor_json TEXT NOT NULL,
  anchor_format TEXT NOT NULL,
  chapter_key TEXT NOT NULL DEFAULT '',
  chapter_json TEXT,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  page_hint INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_marks_chapter_key ON marks (chapter_key);
CREATE INDEX IF NOT EXISTS idx_marks_chapter ON marks (chapter_id);
CREATE INDEX IF NOT EXISTS idx_marks_category ON marks (category);
CREATE INDEX IF NOT EXISTS idx_marks_updated ON marks (updated_at);
CREATE INDEX IF NOT EXISTS idx_marks_file_path ON marks (file_fingerprint, file_path);
CREATE TABLE IF NOT EXISTS marks_tombstones (
  mark_id TEXT PRIMARY KEY,
  deleted_at INTEGER NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS marks_fts USING fts5(
  title, excerpt, note, ai_summary,
  content='marks', content_rowid='rowid',
  tokenize='trigram'
);
CREATE TRIGGER IF NOT EXISTS marks_ai AFTER INSERT ON marks BEGIN
  INSERT INTO marks_fts(rowid, title, excerpt, note, ai_summary)
  VALUES (new.rowid, new.title, new.excerpt, new.note, new.ai_summary);
END;
CREATE TRIGGER IF NOT EXISTS marks_ad AFTER DELETE ON marks BEGIN
  INSERT INTO marks_fts(marks_fts, rowid, title, excerpt, note, ai_summary)
  VALUES ('delete', old.rowid, old.title, old.excerpt, old.note, old.ai_summary);
END;
CREATE TRIGGER IF NOT EXISTS marks_au AFTER UPDATE ON marks BEGIN
  INSERT INTO marks_fts(marks_fts, rowid, title, excerpt, note, ai_summary)
  VALUES ('delete', old.rowid, old.title, old.excerpt, old.note, old.ai_summary);
  INSERT INTO marks_fts(rowid, title, excerpt, note, ai_summary)
  VALUES (new.rowid, new.title, new.excerpt, new.note, new.ai_summary);
END;`,
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
