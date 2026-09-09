import { Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import About from './pages/About'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Ledger from './pages/Ledger'
import NotFound from './pages/NotFound'
import { AuthProvider, useAuth } from './lib/auth'

// 未登录时跳转到登录页
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p>加载中…</p>
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Navbar />
        <main className="page">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/ledger"
              element={
                <RequireAuth>
                  <Ledger />
                </RequireAuth>
              }
            />
            <Route path="/about" element={<About />} />
            {/* 兜底路由：未匹配到任何路径时显示 404 页面 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}

export default App
