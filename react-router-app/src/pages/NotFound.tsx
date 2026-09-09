import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="card not-found">
      <h1>404</h1>
      <p>抱歉，您访问的页面不存在。</p>
      <Link to="/" className="button">
        返回首页
      </Link>
    </div>
  )
}
