import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import type { RecordItem, Summary } from '../lib/api'
import './Ledger.css'

const todayStr = () => new Date().toISOString().slice(0, 10)

function formatMoney(n: number) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Ledger() {
  const [records, setRecords] = useState<RecordItem[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 新增表单
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayStr())
  const [adding, setAdding] = useState(false)

  const query = useCallback(() => {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [startDate, endDate])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = query()
      const [recordsRes, summaryRes] = await Promise.all([
        api<{ records: RecordItem[] }>(`/api/records${q}`),
        api<Summary>(`/api/summary${q}`),
      ])
      setRecords(recordsRes.records)
      setSummary(summaryRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError('')
    try {
      await api('/api/records', {
        method: 'POST',
        body: JSON.stringify({ type, amount: Number(amount), category, note, date }),
      })
      setAmount('')
      setCategory('')
      setNote('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: number) {
    setError('')
    try {
      await api(`/api/records/${id}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  function resetFilter() {
    setStartDate('')
    setEndDate('')
  }

  return (
    <div className="ledger">
      <h1 className="ledger-title">我的记账本</h1>

      {/* 汇总卡片 */}
      <div className="summary">
        <div className="summary-item income">
          <span>总收入</span>
          <strong>¥ {formatMoney(summary.totalIncome)}</strong>
        </div>
        <div className="summary-item expense">
          <span>总支出</span>
          <strong>¥ {formatMoney(summary.totalExpense)}</strong>
        </div>
        <div className="summary-item balance">
          <span>余额</span>
          <strong>¥ {formatMoney(summary.balance)}</strong>
        </div>
      </div>

      {/* 新增记录表单 */}
      <form className="add-form card" onSubmit={handleAdd}>
        <h2>添加记录</h2>
        <div className="add-form-grid">
          <label>
            类型
            <select value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}>
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
          </label>
          <label>
            金额
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>
          <label>
            分类
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={type === 'income' ? '如：工资、兼职' : '如：餐饮、交通'}
            />
          </label>
          <label>
            日期
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="span-2">
            备注
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="选填" />
          </label>
        </div>
        <button className="button" type="submit" disabled={adding}>
          {adding ? '保存中…' : '添加记录'}
        </button>
      </form>

      {/* 日期筛选 */}
      <div className="filter card">
        <h2>按日期筛选</h2>
        <div className="filter-row">
          <label>
            开始日期
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            结束日期
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <button className="button ghost" type="button" onClick={resetFilter}>
            清除筛选
          </button>
        </div>
      </div>

      {error && <p className="ledger-error">{error}</p>}

      {/* 记录列表 */}
      <div className="records card">
        <h2>记录列表</h2>
        {loading ? (
          <p className="records-empty">加载中…</p>
        ) : records.length === 0 ? (
          <p className="records-empty">暂无记录，快去添加一笔吧～</p>
        ) : (
          <ul className="record-list">
            {records.map((r) => (
              <li key={r.id} className="record-item">
                <div className="record-main">
                  <span className={`record-badge ${r.type}`}>
                    {r.type === 'income' ? '收入' : '支出'}
                  </span>
                  <span className="record-category">{r.category}</span>
                  {r.note && <span className="record-note">{r.note}</span>}
                </div>
                <div className="record-side">
                  <span className={`record-amount ${r.type}`}>
                    {r.type === 'income' ? '+' : '-'} ¥ {formatMoney(r.amount)}
                  </span>
                  <span className="record-date">{r.date}</span>
                  <button
                    className="record-delete"
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    title="删除这条记录"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

