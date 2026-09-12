import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { prisma } from '../db.js';
import { AppError, asyncRoute } from '../errors.js';
import { idSchema, imageUrlSchema, slugSchema } from '../validation.js';

export const categoriesRouter = Router();
const categorySchema = z.object({ name: z.string().trim().min(2).max(100), slug: slugSchema,
  description: z.string().trim().max(2000).nullable().optional(), image: imageUrlSchema.nullable().optional(),
}).strict();
categoriesRouter.get('/', asyncRoute(async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { products: { where: { active: true } } } } } });
  res.json(categories.map(({ _count, createdAt: _createdAt, updatedAt: _updatedAt, ...category }) => ({ ...category, productCount: _count.products })));
}));
categoriesRouter.post('/', requireAuth, requireAdmin, asyncRoute(async (req, res) => { res.status(201).json(await prisma.category.create({ data: categorySchema.parse(req.body) })); }));
categoriesRouter.patch('/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const data = categorySchema.partial().refine((value) => Object.keys(value).length > 0, 'Нет полей для изменения').parse(req.body);
  res.json(await prisma.category.update({ where: { id: idSchema.parse(req.params.id) }, data }));
}));
categoriesRouter.delete('/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  if (await prisma.product.count({ where: { categoryId: id } })) throw new AppError(409, 'CATEGORY_IN_USE', 'В категории есть товары. Сначала перенесите их в другую категорию.');
  await prisma.category.delete({ where: { id } });
  res.json({ success: true });
}));
