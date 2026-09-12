import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import { prisma, serializable } from '../db.js';
import { AppError, asyncRoute } from '../errors.js';
import { productInclude, serializeProduct } from '../products/service.js';
import { idSchema } from '../validation.js';

export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);
favoritesRouter.get('/', asyncRoute(async (req, res) => {
  const favorites = await prisma.favorite.findMany({ where: { userId: req.user!.id, product: { active: true } }, include: { product: { include: productInclude } }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(favorites.map((favorite) => serializeProduct(favorite.product)));
}));
favoritesRouter.post('/', asyncRoute(async (req, res) => {
  const { productId } = z.object({ productId: idSchema }).strict().parse(req.body);
  await serializable(async (tx) => {
    if (!await tx.product.findFirst({ where: { id: productId, active: true }, select: { id: true } })) throw new AppError(404, 'NOT_FOUND', 'Товар не найден.');
    const userId = req.user!.id;
    const existing = await tx.favorite.findUnique({ where: { userId_productId: { userId, productId } } });
    if (!existing) {
      if (await tx.favorite.count({ where: { userId } }) >= 200) throw new AppError(409, 'FAVORITES_LIMIT', 'В избранном можно сохранить не больше 200 товаров.');
      await tx.favorite.create({ data: { userId, productId } });
    }
  });
  res.json({ success: true });
}));
favoritesRouter.delete('/:productId', asyncRoute(async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user!.id, productId: idSchema.parse(req.params.productId) } });
  res.json({ success: true });
}));
