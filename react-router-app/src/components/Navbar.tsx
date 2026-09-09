import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import './Navbar.css'

const navItems = [
  { to: '/', label: '首页', end: true },
  { to: '/ledger', label: '记账', end: false },
  { to: '/about', label: '关于', end: false },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          简易记账本
        </NavLink>
        <ul className="navbar-links">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'nav-link active' : 'nav-link'
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
          {user ? (
            <li className="nav-user">
              <span className="nav-username">{user.username}</span>
              <button className="nav-logout" type="button" onClick={handleLogout}>
                退出
              </button>
            </li>
          ) : (
            <li>
              <NavLink
                to="/auth"
                className={({ isActive }) =>
                  isActive ? 'nav-link active' : 'nav-link'
                }
              >
                登录 / 注册
              </NavLink>
            </li>
          )}
        </ul>
      </div>
    </nav>
  )
}
