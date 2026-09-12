import { Prisma } from '@prisma/client';
import { prisma, serializable } from '../db.js';
import { AppError } from '../errors.js';
import { productInclude, serializeProduct } from '../products/service.js';

export const cartInclude = Prisma.validator<Prisma.CartInclude>()({
  items: { orderBy: { createdAt: 'asc' }, include: { variant: { include: { inventory: true, product: { include: productInclude } } } } },
});
type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
export function serializeCart(cart: CartRecord) {
  const items = cart.items.map((item) => ({
    id: item.id, variantId: item.variantId, quantity: item.quantity,
    variant: { id: item.variant.id, sku: item.variant.sku, size: item.variant.size, color: item.variant.color,
      stock: item.variant.active && item.variant.product.active ? item.variant.inventory?.stock ?? 0 : 0 },
    product: serializeProduct(item.variant.product), unitPrice: item.variant.product.price,
    total: item.quantity * item.variant.product.price,
  }));
  return { id: cart.id, items, subtotal: items.reduce((sum, item) => sum + item.total, 0), itemCount: items.reduce((sum, item) => sum + item.quantity, 0) };
}

export async function getCart(userId: string) {
  const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {}, include: cartInclude });
  return serializeCart(cart);
}

export async function addCartItem(userId: string, variantId: string, quantity: number) {
  await serializable(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId }, include: { inventory: true, product: true } });
    if (!variant?.active || !variant.product.active) throw new AppError(404, 'NOT_FOUND', 'Товар больше недоступен.');
    const cart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId } } });
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > 99 || nextQuantity > (variant.inventory?.stock ?? 0)) throw new AppError(409, 'INSUFFICIENT_STOCK', 'Недостаточно товара в наличии.');
    if (!existing && await tx.cartItem.count({ where: { cartId: cart.id } }) >= 100) throw new AppError(409, 'CART_LIMIT', 'В корзину можно добавить не больше 100 разных вариантов.');
    await tx.cartItem.upsert({ where: { cartId_variantId: { cartId: cart.id, variantId } }, create: { cartId: cart.id, variantId, quantity }, update: { quantity: nextQuantity } });
  });
  return getCart(userId);
}

export async function setCartQuantity(userId: string, itemId: string, quantity: number) {
  await serializable(async (tx) => {
    const item = await tx.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, include: { variant: { include: { product: true, inventory: true } } } });
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Товар не найден в корзине.');
    if (!item.variant.active || !item.variant.product.active || quantity > (item.variant.inventory?.stock ?? 0)) throw new AppError(409, 'INSUFFICIENT_STOCK', 'Недостаточно товара в наличии.');
    await tx.cartItem.update({ where: { id: item.id }, data: { quantity } });
  });
  return getCart(userId);
}
