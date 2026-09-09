/** 统一的 API 请求封装，自动携带登录 token */
const TOKEN_KEY = 'ledger_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // 401 说明登录状态失效，清除本地 token
    if (res.status === 401) setToken(null)
    throw new ApiError(res.status, data.message || `请求失败 (${res.status})`)
  }

  return data as T
}

export interface RecordItem {
  id: number
  type: 'income' | 'expense'
  amount: number
  category: string
  note: string
  date: string
  created_at: string
}

export interface Summary {
  totalIncome: number
  totalExpense: number
  balance: number
}

export interface AuthResponse {
  token: string
  user: { id: number; username: string }
}
