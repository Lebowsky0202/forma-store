import { OrderStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { prisma, serializable, type Transaction } from '../db.js';
import { AppError } from '../errors.js';
import { paginated } from '../validation.js';
import type { OrderCreate } from './validation.js';

export const orderInclude = Prisma.validator<Prisma.OrderInclude>()({
  items: true, payment: true, shippingMethod: { select: { id: true, name: true } },
});
type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
export function serializeOrder(order: OrderRecord) {
  return {
    id: order.id, number: order.number, status: order.status, subtotal: order.subtotal,
    shippingCost: order.shippingCost, total: order.total, paymentMethod: order.paymentMethod,
    createdAt: order.createdAt, address: order.address, shippingMethod: order.shippingMethod,
    items: order.items.map(({ id, productId, variantId, name, sku, size, color, image, quantity, unitPrice, total }) => ({ id, productId, variantId, name, sku, size, color, image, quantity, unitPrice, total })),
    payment: order.payment ? { status: order.payment.status, method: order.payment.method } : undefined,
  };
}

export async function createOrder(userId: string, data: OrderCreate, idempotencyKey: string) {
  const requestHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return serializable(async (tx) => {
    const existing = await tx.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } }, include: orderInclude });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Ключ запроса уже использован с другими данными.');
      return serializeOrder(existing);
    }
    const shipping = await tx.shippingMethod.findFirst({ where: { id: data.shippingMethodId, active: true } });
    if (!shipping) throw new AppError(400, 'INVALID_SHIPPING', 'Выберите доступный способ доставки.');
    const cart = await tx.cart.findUnique({ where: { userId }, include: { items: { include: { variant: { include: { inventory: true, product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } } } } } } });
    if (!cart?.items.length) throw new AppError(409, 'EMPTY_CART', 'Добавьте товары в корзину.');
    const subtotal = cart.items.reduce((sum, item) => sum + item.quantity * item.variant.product.price, 0);
    const total = subtotal + shipping.price;
    if (!Number.isSafeInteger(total) || total > 1000000000) throw new AppError(400, 'ORDER_LIMIT', 'Сумма заказа слишком велика. Разделите его на несколько заказов.');
    for (const item of cart.items) {
      if (!item.variant.active || !item.variant.product.active) throw new AppError(409, 'PRODUCT_UNAVAILABLE', `Товар «${item.variant.product.name}» больше недоступен.`);
      const changed = await tx.inventory.updateMany({ where: { variantId: item.variantId, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
      if (changed.count !== 1) throw new AppError(409, 'INSUFFICIENT_STOCK', `Недостаточно товара «${item.variant.product.name}». Обновите корзину.`);
    }
    const order = await tx.order.create({ data: {
      userId, number: `FM-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(4).toString('hex').toUpperCase()}`,
      idempotencyKey, requestHash, address: data.address, shippingMethodId: shipping.id,
      paymentMethod: 'COD', subtotal, shippingCost: shipping.price, total,
      payment: { create: { method: 'COD', status: 'PENDING', amount: total } },
      items: { create: cart.items.map((item) => ({
        productId: item.variant.productId, variantId: item.variantId, name: item.variant.product.name,
        sku: item.variant.sku, size: item.variant.size, color: item.variant.color,
        image: item.variant.product.images[0]?.url ?? '', quantity: item.quantity,
        unitPrice: item.variant.product.price, total: item.quantity * item.variant.product.price,
      })) },
    }, include: orderInclude });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return serializeOrder(order);
  });
}

export async function listOrders(page: number, limit: number, userId?: string, status?: OrderStatus) {
  const where: Prisma.OrderWhereInput = { ...(userId ? { userId } : {}), ...(status ? { status } : {}) };
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({ where, include: orderInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.order.count({ where }),
  ]);
  return paginated(orders.map(serializeOrder), total, page, limit);
}

export const legalTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PAID', 'SHIPPED', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [], CANCELLED: [],
};

async function applyStatus(tx: Transaction, order: OrderRecord, status: OrderStatus) {
  if (order.status === status) return serializeOrder(order);
  if (!legalTransitions[order.status].includes(status)) throw new AppError(409, 'INVALID_TRANSITION', 'Недопустимое изменение статуса заказа.');
  const changed = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status } });
  if (changed.count !== 1) throw new AppError(409, 'CONCURRENT_UPDATE', 'Заказ уже изменён. Обновите страницу.');
  if (status === 'CANCELLED') {
    for (const item of order.items) await tx.inventory.update({ where: { variantId: item.variantId }, data: { stock: { increment: item.quantity } } });
    // A recorded cash payment remains PAID until the merchant handles its refund.
    await tx.payment.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  } else if (status === 'PAID' || status === 'DELIVERED') {
    // Admin confirmation records cash received; no payment provider is contacted.
    await tx.payment.updateMany({ where: { orderId: order.id }, data: { status: 'PAID' } });
  }
  return serializeOrder(await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }));
}

export async function changeOrderStatus(id: string, status: OrderStatus, customerId?: string) {
  return serializable(async (tx) => {
    const order = await tx.order.findFirst({ where: { id, ...(customerId ? { userId: customerId } : {}) }, include: orderInclude });
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Заказ не найден.');
    if (customerId && status === 'CANCELLED' && !['PENDING', 'PROCESSING', 'CANCELLED'].includes(order.status)) throw new AppError(409, 'CANNOT_CANCEL', 'Для отмены этого заказа обратитесь в поддержку.');
    return applyStatus(tx, order, status);
  });
}
