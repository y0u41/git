# 简易记账本

一个前后端分离的记账应用：前端 React + TypeScript，后端 Express + SQLite 数据库。

## 功能特性

- 用户注册 / 登录（scrypt 密码哈希 + token 会话，未登录自动跳转登录页）
- 添加收入 / 支出记录：金额、分类、日期、备注，支持删除
- 汇总卡片展示总收入、总支出、余额
- 按日期区间筛选记录和汇总
- 数据保存在 SQLite 数据库，每个用户只能看到自己的数据

## 技术栈

| 端 | 技术 |
|---|---|
| 前端 | React 19、TypeScript、Vite、React Router 7 |
| 后端 | Node.js、Express 5、better-sqlite3（SQLite，WAL 模式） |
| 鉴权 | Bearer Token（保存在浏览器 localStorage） |

## 目录结构

```
react-router-app/
├── server/            # 后端（Express + SQLite）
│   ├── index.js       # API 服务（首次启动自动建表与迁移）
│   ├── seed.js        # 管理员账号种子脚本
│   └── data.db        # SQLite 数据库（自动生成，已加入 .gitignore）
├── src/               # 前端（React）
│   ├── lib/           # api.ts 请求封装 / auth.tsx 登录状态管理
│   ├── pages/         # Home / Auth(登录注册) / Ledger(记账) / About / NotFound
│   ├── components/    # Navbar 导航栏
│   ├── App.tsx        # 路由与登录守卫
│   └── main.tsx
└── vite.config.ts     # 含 /api → 3001 开发代理
```

## 环境要求

- Node.js ≥ 20（本项目在 Node 26 环境下开发验证）

## 使用步骤

### 1. 安装依赖

```bash
cd react-router-app
npm install
```

### 2. （可选）初始化管理员账号

```bash
npm run seed
```

创建管理员账号：**用户名 `boss` / 密码 `123456`**（role=admin）。
脚本可重复执行，账号已存在时会自动跳过。

### 3. 启动后端

```bash
npm run server
```

看到输出 `记账后端已启动: http://localhost:3001` 即启动成功。

> 注意：后端是纯 API 服务。开发时请继续第 4 步启动前端，浏览器访问 **5173** 端口（直接打开 3001 会显示提示页或 `Cannot GET /`）。若已执行过 `npm run build`，后端会直接托管前端页面，此时访问 3001 也能使用完整应用。

### 4. 启动前端（另开一个终端）

```bash
npm run dev
```

浏览器访问 **http://localhost:5173**（开发服务器会把 `/api` 请求自动代理到 3001 端口的后端）。

### 5. 开始记账

1. 打开首页，点击「前往记账页面」（或顶部导航「记账」）
2. 未登录会自动跳转到登录页：用管理员账号 `boss / 123456` 登录，或点击「去注册」新建普通账号
3. 在「添加记录」表单中填写类型、金额、分类、日期、备注，点击「添加记录」
4. 在「按日期筛选」中选择开始/结束日期，记录列表与汇总卡片同步过滤；点「清除筛选」恢复全部
5. 每条记录右侧有「删除」按钮；顶部导航右上角可随时「退出」登录

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动前端开发服务器（http://localhost:5173） |
| `npm run server` | 启动后端 API 服务（http://localhost:3001） |
| `npm run seed` | 创建/恢复管理员账号 boss（幂等，可重复执行） |
| `npm run build` | 前端生产构建（tsc + vite，输出 dist/） |
| `npm run preview` | 本地预览生产构建 |

## API 一览

除注册/登录外，均需在请求头携带 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册 `{username, password}`，成功即登录并返回 token |
| POST | `/api/auth/login` | 登录 `{username, password}` |
| POST | `/api/auth/logout` | 退出登录（销毁当前 token） |
| GET | `/api/auth/me` | 当前用户信息（含 role） |
| GET | `/api/records` | 记录列表，可带 `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` |
| POST | `/api/records` | 新增记录 `{type: 'income'\|'expense', amount, category, note, date}` |
| DELETE | `/api/records/:id` | 删除自己的记录 |
| GET | `/api/summary` | 汇总 `{totalIncome, totalExpense, balance}`，支持同样的日期参数 |

校验规则：用户名 ≥ 2 字符、密码 ≥ 6 位、金额必须大于 0、日期格式 `YYYY-MM-DD`。

## 常见问题

- **浏览器打开 http://localhost:3001 显示 `Cannot GET /`？** 后端是纯 API 服务，没有首页。请先在另一个终端运行 `npm run dev`，然后访问前端地址 **http://localhost:5173**；或者执行一次 `npm run build` 后重启 `npm run server`，后端就会直接托管前端页面，此时访问 http://localhost:3001 即可使用完整应用。
- **重置数据库**：停止后端 → 删除 `server/data.db`（及 `data.db-shm` / `data.db-wal`）→ 重新启动后端（自动建表）→ 执行 `npm run seed` 恢复管理员账号。
- **启动时提示「端口已被占用」**：说明已有一个 `npm run server` 在运行（旧实例仍占着 3001）。可直接继续使用它；或在 PowerShell 中执行 `$env:PORT=3002; npm run server` 换端口（同时把 `vite.config.ts` 代理目标改为 `http://localhost:3002`）；或用 `Get-NetTCPConnection -LocalPort 3001 -State Listen | Select-Object OwningProcess` 查到旧进程 PID 后 `Stop-Process -Id <PID>` 结束它，再重新启动。
- **启动时提示「src/ 比 dist/ 新」**：说明修改过前端代码但没重新构建，3001 端口显示的还是旧页面。执行 `npm run build` 后重启服务即可；开发调试建议用 `npm run dev`（5173 端口，支持热更新）。
- **生产部署**：最简方式是 `npm run build` 后直接 `npm run server`，浏览器访问 http://localhost:3001 即可（后端自动托管 `dist/` 并支持前端路由刷新）；也可用 Nginx 托管 `dist/` 并将 `/api` 反向代理到 3001 端口。

## 安全提示

`123456` 为弱密码，仅建议本地/学习使用；如需对外部署，建议先实现「修改密码」功能并更换为强密码。

