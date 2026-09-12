import { NavLink, Outlet, Link } from 'react-router-dom';
import './admin.css';

const links = [['/admin', 'Обзор'], ['/admin/products', 'Товары'], ['/admin/categories', 'Категории'], ['/admin/orders', 'Заказы'], ['/admin/users', 'Покупатели']];

export default function AdminLayout() {
  return <div className="adm-shell"><aside className="adm-sidebar">
    <span className="adm-eyebrow">FORMA / УПРАВЛЕНИЕ</span>
    <nav aria-label="Разделы администратора">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/admin'}>{label}</NavLink>)}</nav>
    <Link className="adm-back" to="/">← В магазин</Link>
  </aside><main className="adm-main"><Outlet /></main></div>;
}
