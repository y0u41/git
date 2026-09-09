import { Link } from 'react-router-dom'
import './About.css'

const techStack = [
  { name: 'React', desc: 'UI 库' },
  { name: 'TypeScript', desc: '静态类型系统' },
  { name: 'React Router', desc: '客户端路由' },
  { name: 'Vite', desc: '开发服务器与构建工具' },
]

export default function About() {
  return (
    <div className="card">
      <h1>关于</h1>
      <p>
        本项目演示了如何在 React + TypeScript
        应用中使用 React Router 实现多页面导航，包括 BrowserRouter 路由配置、
        NavLink 导航高亮以及 404 兜底页面。
      </p>

      <h2 className="about-subtitle">技术栈</h2>
      <ul className="tech-list">
        {techStack.map((tech) => (
          <li key={tech.name}>
            <strong>{tech.name}</strong>
            <span> — {tech.desc}</span>
          </li>
        ))}
      </ul>

      <Link to="/" className="button">
        ← 返回首页
      </Link>
    </div>
  )
}
