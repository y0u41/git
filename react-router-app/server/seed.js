// 初始化/补充管理员账号：boss / 123456
// 用法: npm run seed  (或 node server/seed.js)，可重复执行
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, 'data.db'))
db.pragma('journal_mode = WAL')

// 建表（与服务端保持一致）
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`)

// 旧库兼容：缺少 role 列时补充
const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
if (!cols.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
}

const ADMIN_USERNAME = 'boss'
const ADMIN_PASSWORD = '123456'

const existing = db.prepare('SELECT id, role FROM users WHERE username = ?').get(ADMIN_USERNAME)
if (existing) {
  console.log(`管理员账号 ${ADMIN_USERNAME} 已存在 (id=${existing.id}, role=${existing.role})，无需重复创建`)
} else {
  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = crypto.scryptSync(ADMIN_PASSWORD, salt, 64).toString('hex')
  const info = db
    .prepare("INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, 'admin')")
    .run(ADMIN_USERNAME, passwordHash, salt)
  console.log(`管理员账号创建成功: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD} (id=${info.lastInsertRowid})`)
}

db.close()
