import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { AdminError, AdminHeading, AdminLoading } from './AdminShared';
import { formatMoney } from './adminTypes';

interface Stats { products: number; orders: number; users: number; revenue: number; pendingOrders: number }

export default function AdminDashboard() {
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<Stats>('/admin/stats') });
  return <><AdminHeading title="Обзор магазина" text="Товары, покупатели и заказы FORMA." />
    <AdminError error={stats.error} />
    {stats.isPending ? <AdminLoading /> : stats.data && <>
      <div className="adm-stat-grid">
        <Link to="/admin/products" className="adm-stat"><span>Товары в продаже</span><strong>{stats.data.products}</strong><small>Управление ассортиментом ↗</small></Link>
        <Link to="/admin/orders" className="adm-stat"><span>Заказы</span><strong>{stats.data.orders}</strong><small>Все заказы ↗</small></Link>
        <Link to="/admin/users" className="adm-stat"><span>Покупатели</span><strong>{stats.data.users}</strong><small>Управление доступом ↗</small></Link>
        <div className="adm-stat"><span>Выручка</span><strong>{formatMoney(stats.data.revenue)}</strong><small>Полученные оплаты без отменённых заказов</small></div>
      </div>
      <section className="adm-panel adm-action-panel"><div><h2>Новые заказы</h2><p>{stats.data.pendingOrders ? `${stats.data.pendingOrders} заказов ожидают обработки.` : 'Все новые заказы обработаны.'}</p></div><Link className="adm-button" to="/admin/orders?status=PENDING">Перейти к заказам</Link></section>
      <section className="adm-panel"><h2>Ежедневная работа</h2><div className="adm-quick-links"><Link to="/admin/products">Обновить цены и остатки <span>→</span></Link><Link to="/admin/categories">Настроить категории <span>→</span></Link><Link to="/admin/users">Управлять доступом <span>→</span></Link></div></section>
    </>}
  </>;
}
