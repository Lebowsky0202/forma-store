import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { AdminEmpty, AdminError, AdminHeading, AdminLoading, AdminPagination } from './AdminShared';
import { formatDate, formatMoney, orderTransitions, statusLabels, type Order, type OrderStatus, type Paginated } from './adminTypes';

function OrderDetails({ order, onSaved }: { order: Order; onSaved: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const nextStatuses = orderTransitions[order.status];
  const update = useMutation({
    mutationFn: (nextStatus: OrderStatus) => api<Order>(`/admin/orders/${order.id}`, { method: 'PATCH', body: { status: nextStatus } }),
    onSuccess: async () => { setStatus(''); await Promise.all(['admin', 'orders', 'order', 'products', 'product', 'cart', 'favorites'].map(key => queryClient.invalidateQueries({ queryKey: [key] }))); onSaved(`Заказ ${order.number}: статус обновлён.`); },
  });
  return <div className="adm-order-details"><div className="adm-order-info"><section><h3>Получатель</h3><p>{order.address.name}<br /><a href={`tel:${order.address.phone}`}>{order.address.phone}</a><br />{order.address.city}, {order.address.street}{order.address.postalCode && `, ${order.address.postalCode}`}</p></section><section><h3>Оплата и доставка</h3><p>Оплата при получении<br />{order.payment?.status === 'PAID' ? 'Оплата получена' : order.payment?.status === 'CANCELLED' ? 'Оплата отменена' : 'Ожидается оплата'}<br />{order.shippingMethod?.name && <>{order.shippingMethod.name}<br /></>}Товары: {formatMoney(order.subtotal)}<br />Доставка: {formatMoney(order.shippingCost)}<br /><strong>Итого: {formatMoney(order.total)}</strong></p></section></div>
    <ul className="adm-order-items">{order.items.map(item => <li key={item.id}><span><strong>{item.name}</strong><small>{item.sku} · {item.size} · {item.color}</small></span><span>{item.quantity} × {formatMoney(item.unitPrice)}</span><strong>{formatMoney(item.total)}</strong></li>)}</ul>
    <AdminError error={update.error} />
    {nextStatuses.length > 0 ? <form className="adm-status-form" onSubmit={event => { event.preventDefault(); if (status && nextStatuses.includes(status)) update.mutate(status); }}><label className="adm-field">Новый статус<select value={status} onChange={event => setStatus(event.target.value as OrderStatus | '')} disabled={update.isPending} required><option value="">Выберите действие</option>{nextStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><button className="adm-button" type="submit" disabled={!status || update.isPending}>{update.isPending ? 'Обновляем…' : 'Обновить статус'}</button>{status === 'CANCELLED' && <p className="adm-hint">Заказ будет отменён, товары вернутся в остаток.{order.payment?.status === 'PAID' && ' Возврат уже полученных денег необходимо провести отдельно; отмена не возвращает платёж.'}</p>}{status === 'PAID' && <p className="adm-hint">Отмечайте оплату только после фактического получения денег.</p>}{status === 'DELIVERED' && <p className="adm-hint">Подтвердите, что покупатель получил заказ и оплатил его. Доставка также отмечает оплату полученной.</p>}</form> : <p className="adm-hint">Заказ завершён. Изменение статуса недоступно.{order.status === 'CANCELLED' && order.payment?.status === 'PAID' && ' Оплата получена: проверьте возврат денег покупателю отдельно.'}</p>}
  </div>;
}

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const currentStatus = params.get('status') || '';
  const status = Object.hasOwn(statusLabels, currentStatus) ? currentStatus : '';
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const queryParams = new URLSearchParams({ page: String(page), limit: '10' });
  if (status) queryParams.set('status', status);
  const orders = useQuery({ queryKey: ['admin', 'orders', page, status], queryFn: () => api<Paginated<Order>>(`/admin/orders?${queryParams}`) });
  useEffect(() => { if (orders.data && page > Math.max(1, orders.data.pages)) setPage(Math.max(1, orders.data.pages)); }, [orders.data, page]);
  return <><AdminHeading title="Заказы" text="Состав заказа, доставка и обработка." />
    {notice && <p className="adm-notice" role="status">{notice}</p>}<AdminError error={orders.error} />
    <div className="adm-toolbar"><label className="adm-field">Статус заказа<select value={status} onChange={event => { setParams(event.target.value ? { status: event.target.value } : {}); setPage(1); setExpanded(null); }}><option value="">Все статусы</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {orders.isPending ? <AdminLoading /> : orders.data && (orders.data.items.length ? <><div className="adm-orders">{orders.data.items.map(order => <article className="adm-order" key={order.id}><div className="adm-order-summary"><div><strong>Заказ {order.number}</strong><span>{formatDate(order.createdAt)} · {order.address.name}</span></div><span className={`adm-badge ${['DELIVERED', 'PAID'].includes(order.status) ? 'adm-positive' : ''}`}>{statusLabels[order.status]}</span><strong>{formatMoney(order.total)}</strong><button className="adm-button adm-secondary" aria-expanded={expanded === order.id} aria-controls={`order-${order.id}`} onClick={() => setExpanded(expanded === order.id ? null : order.id)}>{expanded === order.id ? 'Свернуть' : 'Подробнее'}</button></div>{expanded === order.id && <div id={`order-${order.id}`}><OrderDetails key={`${order.id}-${order.status}`} order={order} onSaved={setNotice} /></div>}</article>)}</div><AdminPagination page={page} pages={orders.data.pages} total={orders.data.total} onChange={value => { setPage(value); setExpanded(null); }} /></> : <AdminEmpty>Заказов с выбранным статусом пока нет.</AdminEmpty>)}
  </>;
}
