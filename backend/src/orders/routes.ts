import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { prisma } from '../db.js';
import { AppError, asyncRoute } from '../errors.js';
import { idSchema } from '../validation.js';
import { changeOrderStatus, createOrder, listOrders, orderInclude, serializeOrder } from './service.js';
import { createOrderSchema, idempotencySchema, orderQuerySchema } from './validation.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);
ordersRouter.post('/', asyncRoute(async (req, res) => {
  const key = idempotencySchema.parse(req.header('Idempotency-Key'));
  res.status(201).json(await createOrder(req.user!.id, createOrderSchema.parse(req.body), key));
}));
ordersRouter.get('/', asyncRoute(async (req, res) => {
  const { page, limit, status } = orderQuerySchema.parse(req.query);
  res.json(await listOrders(page, limit, req.user!.id, status));
}));
ordersRouter.get('/:id', asyncRoute(async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: idSchema.parse(req.params.id), userId: req.user!.id }, include: orderInclude });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Заказ не найден.');
  res.json(serializeOrder(order));
}));
ordersRouter.post('/:id/cancel', asyncRoute(async (req, res) => { res.json(await changeOrderStatus(idSchema.parse(req.params.id), 'CANCELLED', req.user!.id)); }));
