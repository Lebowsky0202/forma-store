import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { publicUser } from '../auth/service.js';
import { prisma, serializable } from '../db.js';
import { AppError, asyncRoute } from '../errors.js';
import { changeOrderStatus, listOrders } from '../orders/service.js';
import { orderQuerySchema, orderStatusSchema } from '../orders/validation.js';
import { listProducts } from '../products/service.js';
import { productQuerySchema } from '../products/validation.js';
import { idSchema, paginated, paginationSchema } from '../validation.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/stats', asyncRoute(async (_req, res) => {
  const [products, orders, users, totals, pendingOrders] = await prisma.$transaction([
    prisma.product.count({ where: { active: true } }), prisma.order.count(), prisma.user.count(),
    prisma.order.aggregate({ where: { status: { not: 'CANCELLED' }, payment: { status: 'PAID' } }, _sum: { total: true } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
  ]);
  res.json({ products, orders, users, revenue: totals._sum.total ?? 0, pendingOrders });
}));
adminRouter.get('/products', asyncRoute(async (req, res) => { res.json(await listProducts(productQuerySchema.parse(req.query), true)); }));
adminRouter.get('/orders', asyncRoute(async (req, res) => {
  const { page, limit, status } = orderQuerySchema.parse(req.query);
  res.json(await listOrders(page, limit, undefined, status));
}));
adminRouter.patch('/orders/:id', asyncRoute(async (req, res) => {
  const { status } = z.object({ status: orderStatusSchema }).strict().parse(req.body);
  res.json(await changeOrderStatus(idSchema.parse(req.params.id), status));
}));
adminRouter.get('/users', asyncRoute(async (req, res) => {
  const { page, limit, search } = paginationSchema.extend({ search: z.string().trim().max(150).optional() }).parse(req.query);
  const where: Prisma.UserWhereInput = search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {};
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    prisma.user.count({ where }),
  ]);
  res.json(paginated(users.map((user) => ({ ...publicUser(user), active: user.active })), total, page, limit));
}));
adminRouter.patch('/users/:id', asyncRoute(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = z.object({ role: z.enum(['USER', 'ADMIN']).optional(), active: z.boolean().optional() }).strict()
    .refine((value) => Object.keys(value).length > 0, 'Нет полей для изменения').parse(req.body);
  if (id === req.user!.id && (data.active === false || data.role === 'USER')) throw new AppError(409, 'SELF_PROTECTION', 'Нельзя отключить собственный доступ администратора.');
  const user = await serializable(async (tx) => {
    const current = await tx.user.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Пользователь не найден.');
    if (current.role === 'ADMIN' && current.active && (data.role === 'USER' || data.active === false)) {
      const administrators = await tx.user.count({ where: { active: true, role: 'ADMIN' } });
      if (administrators <= 1) throw new AppError(409, 'LAST_ADMIN', 'В магазине должен остаться активный администратор.');
    }
    const changed = (data.role !== undefined && data.role !== current.role) || (data.active !== undefined && data.active !== current.active);
    if (changed) await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    return tx.user.update({ where: { id }, data: { ...data, ...(changed ? { tokenVersion: { increment: 1 } } : {}) } });
  });
  res.json(publicUser(user));
}));
