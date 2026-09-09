import { Link } from 'react-router-dom'
import './Home.css'

const features = [
  { title: 'React', desc: '使用组件化方式构建用户界面' },
  { title: 'TypeScript', desc: '静态类型检查，代码更健壮' },
  { title: 'React Router', desc: '声明式路由，页面间无缝切换' },
  { title: 'Vite', desc: '极速的开发与构建体验' },
]

export default function Home() {
  return (
    <div className="card">
      <h1>首页</h1>
      <p>
        这是一个使用 React + TypeScript + React Router
        搭建的多页面应用示例。点击下方按钮或顶部导航栏，即可在不同页面之间切换。
      </p>
      <Link to="/ledger" className="button">
        前往记账页面 →
      </Link>

      <div className="features">
        {features.map((feature) => (
          <div key={feature.title} className="feature">
            <h3>{feature.title}</h3>
            <p>{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
