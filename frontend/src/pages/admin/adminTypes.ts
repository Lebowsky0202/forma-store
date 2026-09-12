import type { Order as StoreOrder, User } from '../../shared/types';
export type { Category, Product, Page as Paginated } from '../../shared/types';

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type Order = Omit<StoreOrder, 'status'> & { status: OrderStatus };
export type AdminUser = User & { active: boolean };

export const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'Новый', PROCESSING: 'В обработке', PAID: 'Оплачен',
  SHIPPED: 'Отправлен', DELIVERED: 'Доставлен', CANCELLED: 'Отменён',
};

export const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [], CANCELLED: [],
};

export const formatMoney = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₸`;
export const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value));
