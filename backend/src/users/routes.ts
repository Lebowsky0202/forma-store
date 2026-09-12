import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { publicUser } from '../auth/service.js';
import { prisma, serializable } from '../db.js';
import { AppError, asyncRoute } from '../errors.js';
import { addressSchema, idSchema, phoneSchema } from '../validation.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.patch('/me', asyncRoute(async (req, res) => {
  const data = z.object({ name: z.string().trim().min(2).max(120), phone: phoneSchema.nullable().optional() }).strict().parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data });
  res.json(publicUser(user));
}));
usersRouter.get('/me/addresses', asyncRoute(async (req, res) => {
  res.json(await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 20 }));
}));
usersRouter.post('/me/addresses', asyncRoute(async (req, res) => {
  const data = addressSchema.parse(req.body);
  const address = await serializable(async (tx) => {
    const count = await tx.address.count({ where: { userId: req.user!.id } });
    if (count >= 20) throw new AppError(409, 'ADDRESS_LIMIT', 'Можно сохранить не больше 20 адресов.');
    return tx.address.create({ data: { ...data, userId: req.user!.id } });
  });
  res.status(201).json(address);
}));
usersRouter.delete('/me/addresses/:id', asyncRoute(async (req, res) => {
  const result = await prisma.address.deleteMany({ where: { id: idSchema.parse(req.params.id), userId: req.user!.id } });
  if (!result.count) throw new AppError(404, 'NOT_FOUND', 'Адрес не найден.');
  res.json({ success: true });
}));
