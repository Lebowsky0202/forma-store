import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Package } from 'lucide-react';
import { api } from '../shared/api/client';
import { useAuthStore } from '../shared/store/auth';
import type { Order, Page } from '../shared/types';
import { Alert, Breadcrumbs, Button, EmptyState, ErrorState, Loading, Pagination, Price, statusLabels } from '../shared/ui';
import AccountNav from '../components/AccountNav';

export default function OrdersPage() {
  const user = useAuthStore(state => state.user)!;
  const [page, setPage] = useState(1);
  const orders = useQuery({ queryKey: ['orders', user.id, page], queryFn: () => api<Page<Order>>(`/orders?page=${page}&limit=10`) });
  return <div className="container page-space"><Breadcrumbs items={[{ label: 'Личный кабинет', to: '/profile' }, { label: 'История заказов' }]} /><div className="page-title-row"><h1>Твои покупки<span className="heading-dot">.</span></h1></div><AccountNav />{orders.isLoading ? <Loading /> : orders.error ? <ErrorState error={orders.error} retry={() => orders.refetch()} /> : orders.data?.items.length ? <><div className="orders-list">{orders.data.items.map(order => <OrderCard key={order.id} order={order} />)}</div><Pagination page={orders.data.page} pages={orders.data.pages} onChange={setPage} /></> : <EmptyState title="Всё начинается с первой вещи" description="Здесь появятся ваши заказы, их состав и статус доставки." />}</div>;
}

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const client = useQueryClient();
  const cancel = useMutation({ mutationFn: () => api<Order>(`/orders/${order.id}/cancel`, { method: 'POST' }), onSuccess: () => { setConfirm(false); client.invalidateQueries({ queryKey: ['orders'] }); client.invalidateQueries({ queryKey: ['products'] }); client.invalidateQueries({ queryKey: ['product'] }); } });
  const date = new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return <article className="order-card"><div className="order-card-heading"><div className="order-number"><Package size={21} /><div><h2>Заказ № {order.number}</h2><time dateTime={order.createdAt}>{date}</time></div></div><span className={`order-status status-${order.status.toLowerCase()}`}>{statusLabels[order.status] ?? order.status}</span><Price value={order.total} /><button className="text-link" aria-expanded={expanded} aria-controls={`order-${order.id}`} onClick={() => setExpanded(!expanded)}>{expanded ? 'Свернуть' : 'Подробнее'}<ChevronDown size={18} className={expanded ? 'rotate' : ''} /></button></div>{!expanded && <div className="order-preview">{order.items.slice(0, 6).map(item => <img key={item.id} src={item.image} alt={item.name} loading="lazy" />)}<span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} шт.</span></div>}{expanded && <div className="order-content" id={`order-${order.id}`}><div className="order-products">{order.items.map(item => <div className="order-product" key={item.id}><img src={item.image} alt={item.name} loading="lazy" /><div><h3>{item.name}</h3><p>{item.size} · {item.color} · {item.quantity} шт.</p><span className="muted">Артикул: {item.sku}</span></div><Price value={item.total} /></div>)}</div><div className="order-information"><section><h3>Доставка</h3><p>{order.address.name}<br />{order.address.phone}<br />{order.address.city}, {order.address.street}{order.address.postalCode && <><br />{order.address.postalCode}</>}</p><p>{order.shippingMethod?.name}</p></section><section><h3>Оплата</h3><p>При получении · {order.payment?.status === 'PAID' ? 'Оплачен' : 'Без предоплаты'}</p><div className="summary-line"><span>Товары</span><Price value={order.subtotal} /></div><div className="summary-line"><span>Доставка</span><Price value={order.shippingCost} /></div><div className="summary-line"><strong>Итого</strong><Price value={order.total} /></div></section></div>{['PENDING', 'PROCESSING'].includes(order.status) && <div className="order-cancel">{confirm ? <><p>Отменить этот заказ? Товары вернутся в продажу.</p><div className="form-actions"><Button disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? 'Отменяем…' : 'Да, отменить заказ'}</Button><Button className="secondary" disabled={cancel.isPending} onClick={() => setConfirm(false)}>Оставить заказ</Button></div></> : <button className="text-link" onClick={() => setConfirm(true)}>Отменить заказ</button>}</div>}{cancel.error && <Alert>{cancel.error.message}</Alert>}{cancel.isSuccess && <Alert success>Заказ отменён.</Alert>}</div>}</article>;
}
