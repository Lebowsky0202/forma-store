import { Prisma } from '@prisma/client';
import { prisma, serializable, type Transaction } from '../db.js';
import { AppError } from '../errors.js';
import { paginated } from '../validation.js';
import type { ProductCreate, ProductQuery, ProductUpdate } from './validation.js';

export const productInclude = Prisma.validator<Prisma.ProductInclude>()({
  category: true,
  images: { orderBy: { position: 'asc' } },
  variants: { where: { active: true }, include: { inventory: true }, orderBy: { createdAt: 'asc' } },
  _count: { select: { reviews: true } },
});
export type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
export function serializeProduct(product: ProductRecord, averageRating?: number) {
  return {
    id: product.id, name: product.name, slug: product.slug, description: product.description,
    price: product.price, oldPrice: product.oldPrice, categoryId: product.categoryId,
    category: { id: product.category.id, name: product.category.name, slug: product.category.slug, description: product.category.description, image: product.category.image },
    images: product.images.map(({ id, url, alt, position }) => ({ id, url, alt, position })),
    variants: product.variants.map(({ id, sku, size, color, inventory }) => ({ id, sku, size, color, stock: inventory?.stock ?? 0 })),
    material: product.material, care: product.care, featured: product.featured, active: product.active, createdAt: product.createdAt,
    reviewCount: product._count.reviews, ...(averageRating !== undefined ? { averageRating } : {}),
  };
}

export async function listProducts(query: ProductQuery, admin = false) {
  const where: Prisma.ProductWhereInput = {
    ...(!admin ? { active: true } : query.active !== undefined ? { active: query.active === 'true' } : {}),
    ...(query.search ? { OR: [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ] } : {}),
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined ? { price: { gte: query.minPrice, lte: query.maxPrice } } : {}),
    ...(query.featured ? { featured: query.featured === 'true' } : {}),
    ...(query.inStock === 'true' ? { variants: { some: { active: true, inventory: { stock: { gt: 0 } } } } } : {}),
  };
  const sortMap: Record<ProductQuery['sort'], Prisma.ProductOrderByWithRelationInput> = {
    newest: { createdAt: 'desc' }, price_asc: { price: 'asc' }, price_desc: { price: 'desc' }, popular: { orderItems: { _count: 'desc' } },
  };
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include: productInclude, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [sortMap[query.sort], { id: 'asc' }] }),
    prisma.product.count({ where }),
  ]);
  const ratings = await prisma.review.groupBy({ by: ['productId'], where: { productId: { in: products.map((product) => product.id) } }, _avg: { rating: true } });
  const averages = new Map(ratings.map((rating) => [rating.productId, rating._avg.rating ?? 0]));
  return paginated(products.map((product) => serializeProduct(product, averages.get(product.id) ?? 0)), total, query.page, query.limit);
}

export async function productDetail(idOrSlug: string) {
  const product = await prisma.product.findFirst({ where: { active: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include: productInclude });
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Товар не найден.');
  const rating = await prisma.review.aggregate({ where: { productId: product.id }, _avg: { rating: true } });
  return serializeProduct(product, rating._avg.rating ?? 0);
}

async function requireCategory(tx: Transaction, categoryId: string) {
  if (!await tx.category.findUnique({ where: { id: categoryId }, select: { id: true } })) throw new AppError(400, 'INVALID_CATEGORY', 'Выберите существующую категорию.');
}

export async function createProduct(data: ProductCreate) {
  const { images, variants, ...fields } = data;
  if (variants.some((variant) => variant.id)) throw new AppError(400, 'INVALID_VARIANT', 'Новый товар не может содержать существующие варианты.');
  return serializable(async (tx) => {
    await requireCategory(tx, data.categoryId);
    const product = await tx.product.create({ data: {
      ...fields,
      images: { create: images.map((image, position) => ({ ...image, position })) },
      variants: { create: variants.map(({ stock, id: _id, ...variant }) => ({ ...variant, inventory: { create: { stock } } })) },
    }, include: productInclude });
    return serializeProduct(product, 0);
  });
}

export async function updateProduct(id: string, data: ProductUpdate) {
  return serializable(async (tx) => {
    const current = await tx.product.findUnique({ where: { id }, include: { variants: true } });
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Товар не найден.');
    if (data.categoryId) await requireCategory(tx, data.categoryId);
    const finalPrice = data.price ?? current.price;
    const finalOldPrice = data.oldPrice === undefined ? current.oldPrice : data.oldPrice;
    if (finalOldPrice !== null && finalOldPrice < finalPrice) throw new AppError(400, 'INVALID_PRICE', 'Старая цена должна быть не ниже текущей.');
    const { images, variants, ...fields } = data;
    await tx.product.update({ where: { id }, data: fields });
    if (images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({ data: images.map((image, position) => ({ ...image, position, productId: id })) });
    }
    if (variants) {
      const retainedIds = variants.flatMap((variant) => variant.id ? [variant.id] : []);
      if (retainedIds.some((variantId) => !current.variants.some((variant) => variant.id === variantId))) throw new AppError(400, 'INVALID_VARIANT', 'Вариант не принадлежит товару.');
      // Archive omitted variants: order snapshots and inventory references must remain intact.
      await tx.productVariant.updateMany({ where: { productId: id, id: { notIn: retainedIds } }, data: { active: false } });
      for (const { id: variantId, stock, ...variant } of variants) {
        if (variantId) {
          await tx.productVariant.update({ where: { id: variantId }, data: { ...variant, active: true, inventory: { upsert: { create: { stock }, update: { stock } } } } });
        } else {
          await tx.productVariant.create({ data: { ...variant, productId: id, inventory: { create: { stock } } } });
        }
      }
    }
    const product = await tx.product.findUniqueOrThrow({ where: { id }, include: productInclude });
    const rating = await tx.review.aggregate({ where: { productId: id }, _avg: { rating: true } });
    return serializeProduct(product, rating._avg.rating ?? 0);
  });
}
