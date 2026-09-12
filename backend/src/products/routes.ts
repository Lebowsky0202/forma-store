import { Router } from 'express';
import { requireAdmin, requireAuth } from '../auth/middleware.js';
import { prisma } from '../db.js';
import { asyncRoute } from '../errors.js';
import { idSchema } from '../validation.js';
import { createProduct, listProducts, productDetail, updateProduct } from './service.js';
import { createProductSchema, productQuerySchema, updateProductSchema } from './validation.js';

export const productsRouter = Router();
productsRouter.get('/', asyncRoute(async (req, res) => { res.json(await listProducts(productQuerySchema.parse(req.query))); }));
productsRouter.get('/:idOrSlug', asyncRoute(async (req, res) => { res.json(await productDetail(idSchema.parse(req.params.idOrSlug))); }));
productsRouter.post('/', requireAuth, requireAdmin, asyncRoute(async (req, res) => { res.status(201).json(await createProduct(createProductSchema.parse(req.body))); }));
productsRouter.patch('/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => { res.json(await updateProduct(idSchema.parse(req.params.id), updateProductSchema.parse(req.body))); }));
productsRouter.delete('/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  await prisma.product.update({ where: { id: idSchema.parse(req.params.id) }, data: { active: false } });
  res.json({ success: true });
}));
