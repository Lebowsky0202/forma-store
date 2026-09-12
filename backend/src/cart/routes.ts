import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { prisma } from '../db.js';
import { AppError, asyncRoute } from '../errors.js';
import { idSchema } from '../validation.js';
import { addCartItem, getCart, setCartQuantity } from './service.js';

export const cartRouter = Router();
cartRouter.use(requireAuth);
const quantitySchema = z.number().int().min(1).max(99);
cartRouter.get('/', asyncRoute(async (req, res) => { res.json(await getCart(req.user!.id)); }));
cartRouter.post('/items', asyncRoute(async (req, res) => {
  const data = z.object({ variantId: idSchema, quantity: quantitySchema }).strict().parse(req.body);
  res.json(await addCartItem(req.user!.id, data.variantId, data.quantity));
}));
cartRouter.patch('/items/:id', asyncRoute(async (req, res) => {
  const data = z.object({ quantity: quantitySchema }).strict().parse(req.body);
  res.json(await setCartQuantity(req.user!.id, idSchema.parse(req.params.id), data.quantity));
}));
cartRouter.delete('/items/:id', asyncRoute(async (req, res) => {
  const deleted = await prisma.cartItem.deleteMany({ where: { id: idSchema.parse(req.params.id), cart: { userId: req.user!.id } } });
  if (!deleted.count) throw new AppError(404, 'NOT_FOUND', 'Товар не найден в корзине.');
  res.json(await getCart(req.user!.id));
}));
cartRouter.delete('/', asyncRoute(async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { cart: { userId: req.user!.id } } });
  res.json(await getCart(req.user!.id));
}));
