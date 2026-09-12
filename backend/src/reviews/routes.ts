import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { prisma } from '../db.js';
import { AppError, asyncRoute } from '../errors.js';
import { idSchema } from '../validation.js';

export const reviewsRouter = Router();
const reviewSelect = { id: true, rating: true, comment: true, createdAt: true, user: { select: { name: true } } } as const;
async function activeProduct(id: string) {
  if (!await prisma.product.findFirst({ where: { id, active: true }, select: { id: true } })) throw new AppError(404, 'NOT_FOUND', 'Товар не найден.');
}
reviewsRouter.get('/:id/reviews', asyncRoute(async (req, res) => {
  const productId = idSchema.parse(req.params.id);
  await activeProduct(productId);
  res.json(await prisma.review.findMany({ where: { productId }, select: reviewSelect, orderBy: { createdAt: 'desc' }, take: 100 }));
}));
reviewsRouter.post('/:id/reviews', requireAuth, asyncRoute(async (req, res) => {
  const productId = idSchema.parse(req.params.id);
  await activeProduct(productId);
  const data = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().min(5).max(2000) }).strict().parse(req.body);
  const review = await prisma.review.create({ data: { ...data, productId, userId: req.user!.id }, select: reviewSelect });
  res.status(201).json(review);
}));
