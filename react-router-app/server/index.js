import crypto from 'node:crypto'
import express from 'express'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------- 数据库初始化 ----------
const db = new Database(path.join(__dirname, 'data.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount REAL NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL DEFAULT '其他',
    note TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, date);
`)

// 旧库兼容：若 users 表缺少 role 列则补充
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
if (!userColumns.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
}

// ---------- 密码工具（scrypt 哈希） ----------
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

function verifyPassword(password, salt, hash) {
  const candidate = hashPassword(password, salt)
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'))
}

// ---------- 鉴权中间件 ----------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: '未登录' })

  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token)
  if (!session) return res.status(401).json({ message: '登录已过期，请重新登录' })

  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.user_id)
  if (!user) return res.status(401).json({ message: '用户不存在' })

  req.user = user
  next()
}

const app = express()
app.use(express.json())

// ---------- 认证接口 ----------
// 注册
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return res.status(400).json({ message: '用户名至少 2 个字符' })
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: '密码至少 6 位' })
  }

  const name = username.trim()
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(name)
  if (exists) return res.status(409).json({ message: '用户名已被注册' })

  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = hashPassword(password, salt)
  const info = db
    .prepare('INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)')
    .run(name, passwordHash, salt)

  const token = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, info.lastInsertRowid)

  res.status(201).json({ token, user: { id: info.lastInsertRowid, username: name, role: 'user' } })
})

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  const user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(String(username || '').trim())
  if (!user || !verifyPassword(String(password || ''), user.salt, user.password_hash)) {
    return res.status(401).json({ message: '用户名或密码错误' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id)

  res.json({ token, user: { id: user.id, username: user.username, role: user.role } })
})

// 退出登录
app.post('/api/auth/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.headers.authorization.slice(7))
  res.json({ message: '已退出' })
})

// 当前用户
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// ---------- 记账接口 ----------
function parseDateFilter(query) {
  const conditions = []
  const params = []
  if (query.startDate) {
    conditions.push('date >= ?')
    params.push(String(query.startDate))
  }
  if (query.endDate) {
    conditions.push('date <= ?')
    params.push(String(query.endDate))
  }
  return { conditions, params }
}

// 记录列表（支持按日期区间筛选）
app.get('/api/records', requireAuth, (req, res) => {
  const { conditions, params } = parseDateFilter(req.query)
  const where = ['user_id = ?', ...conditions]
  const rows = db
    .prepare(`SELECT * FROM records WHERE ${where.join(' AND ')} ORDER BY date DESC, id DESC`)
    .all(req.user.id, ...params)
  res.json({ records: rows })
})

// 汇总：总收入 / 总支出 / 余额（同样支持日期筛选）
app.get('/api/summary', requireAuth, (req, res) => {
  const { conditions, params } = parseDateFilter(req.query)
  const where = ['user_id = ?', ...conditions]
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS totalIncome,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS totalExpense
       FROM records WHERE ${where.join(' AND ')}`,
    )
    .get(req.user.id, ...params)
  res.json({
    totalIncome: row.totalIncome,
    totalExpense: row.totalExpense,
    balance: row.totalIncome - row.totalExpense,
  })
})

// 新增记录
app.post('/api/records', requireAuth, (req, res) => {
  const { type, amount, category, note, date } = req.body || {}
  const value = Number(amount)
  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ message: 'type 必须是 income 或 expense' })
  }
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ message: '金额必须大于 0' })
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).json({ message: '日期格式必须为 YYYY-MM-DD' })
  }

  const info = db
    .prepare(
      `INSERT INTO records (user_id, type, amount, category, note, date)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      req.user.id,
      type,
      value,
      String(category || '其他').trim() || '其他',
      String(note || '').trim(),
      String(date),
    )

  const record = db.prepare('SELECT * FROM records WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json({ record })
})

// 删除记录
app.delete('/api/records/:id', requireAuth, (req, res) => {
  const info = db
    .prepare('DELETE FROM records WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id)
  if (info.changes === 0) return res.status(404).json({ message: '记录不存在' })
  res.json({ message: '已删除' })
})

// ---------- 页面托管 ----------
const distDir = path.join(__dirname, '..', 'dist')
const srcDir = path.join(__dirname, '..', 'src')
const hasDist = fs.existsSync(path.join(distDir, 'index.html'))

// 递归获取目录中最新的文件修改时间，用于检测构建产物是否过期
function newestMtime(dir) {
  let newest = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const mtime = entry.isDirectory() ? newestMtime(full) : fs.statSync(full).mtimeMs
    if (mtime > newest) newest = mtime
  }
  return newest
}

let staleBuild = false
if (hasDist) {
  try {
    const distMtime = fs.statSync(path.join(distDir, 'index.html')).mtimeMs
    staleBuild = fs.existsSync(srcDir) && newestMtime(srcDir) > distMtime
  } catch {
    // 检测失败不影响正常启动
  }

  // 生产模式：已执行过 npm run build 时，由后端直接托管前端页面，
  // 浏览器访问 http://localhost:3001 即可使用完整应用
  app.use(express.static(distDir))
  // 非 /api 开头的 GET 请求统一返回前端入口（支持 /ledger 等前端路由刷新）
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distDir, 'index.html'))
    }
    next()
  })
} else {
  // 开发模式：后端仅提供 API，前端由 Vite 提供（npm run dev → http://localhost:5173）
  app.get('/', (req, res) => {
    res.type('html').send(
      '<h1>记账后端 API 运行中 ✅</h1>' +
        '<p>这里是纯 API 服务，浏览器请访问前端页面 ' +
        '<a href="http://localhost:5173">http://localhost:5173</a>（需先在另一个终端运行 <code>npm run dev</code>）。</p>' +
        '<p>或在项目目录执行 <code>npm run build</code> 后重启本服务（<code>npm run server</code>），即可直接在本端口使用完整应用。</p>',
    )
  })
}

const PORT = process.env.PORT || 3001
const server = app.listen(PORT, () => {
  console.log(`记账后端已启动: http://localhost:${PORT}`)
  if (hasDist) {
    console.log('页面模式：托管 dist/ 构建产物，浏览器访问上面地址即可使用完整应用')
    if (staleBuild) {
      console.log('⚠️  检测到 src/ 前端源码比 dist/ 构建产物新，当前页面可能是旧版本：')
      console.log('    请执行 npm run build 后重启本服务；开发调试请使用 npm run dev（端口 5173）。')
    }
  } else {
    console.log('页面模式：纯 API（未检测到 dist/），前端请运行 npm run dev 后访问 http://localhost:5173')
  }
})

// 端口占用等启动错误：给出明确中文提示，而不是抛出大段英文堆栈后崩溃
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ 启动失败：端口 ${PORT} 已被占用。`)
    console.error('   通常是已有一个 npm run server 在运行，可直接继续使用它；或者：')
    console.error(`   1) 换个端口启动（PowerShell）：$env:PORT=3002; npm run server`)
    console.error('      （同时把 vite.config.ts 中代理目标改为 http://localhost:3002）')
    console.error(`   2) 结束占用端口的旧进程后再启动：`)
    console.error(`      Get-NetTCPConnection -LocalPort ${PORT} -State Listen | Select-Object OwningProcess`)
    console.error('      Stop-Process -Id <上面查到的OwningProcess>')
    process.exit(1)
  }
  console.error('\n❌ 服务器启动失败:', err.message)
  process.exit(1)
})

