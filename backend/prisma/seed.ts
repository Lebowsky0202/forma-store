import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { constants } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { photo, seedProducts } from './seed-products.js';

dotenv.config({ path: ['../.env', '.env'] });
const prisma = new PrismaClient();

function seedPassword(key: string) {
  const value = process.env[key];
  if (!value || value.length < 10 || Buffer.byteLength(value, 'utf8') > 72) throw new Error(`${key} must contain at least 10 characters and at most 72 UTF-8 bytes. No default password is supplied.`);
  return value;
}

async function seed() {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
  const assetsDir = fileURLToPath(new URL('./seed-assets/', import.meta.url));
  await mkdir(uploadDir, { recursive: true });
  for (const file of await readdir(assetsDir)) {
    await copyFile(path.join(assetsDir, file), path.join(uploadDir, file), constants.COPYFILE_EXCL)
      .catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
  }
  const adminHash = await bcrypt.hash(seedPassword('SEED_ADMIN_PASSWORD'), 12);
  const userHash = await bcrypt.hash(seedPassword('SEED_USER_PASSWORD'), 12);
  await prisma.user.upsert({ where: { email: 'admin@forma.local' }, update: {}, create: {
    email: 'admin@forma.local', name: 'Администратор FORMA', passwordHash: adminHash, role: 'ADMIN', cart: { create: {} },
  } });
  await prisma.user.upsert({ where: { email: 'user@forma.local' }, update: {}, create: {
    email: 'user@forma.local', name: 'Покупатель', passwordHash: userHash, cart: { create: {} },
  } });
  const categories = [
    { name: 'Женщинам', slug: 'zhenshchinam', description: 'Повседневная одежда и продуманные сочетания.', image: photo('photo-1539533018447-63fcce2678e3') },
    { name: 'Мужчинам', slug: 'muzhchinam', description: 'Удобные вещи для вашего ритма.', image: photo('photo-1596755094514-f87e34085b2c') },
    { name: 'Аксессуары', slug: 'aksessuary', description: 'Детали, которые завершают образ.', image: photo('photo-1657603635372-023411921d31') },
  ];
  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const saved = await prisma.category.upsert({ where: { slug: category.slug }, create: category, update: {} });
    categoryIds.set(category.slug, saved.id);
  }
  for (const [index, product] of seedProducts.entries()) {
    const sizes = product.category === 'aksessuary' ? ['ONE SIZE'] : ['XS', 'S', 'M', 'L', 'XL'];
    await prisma.product.upsert({ where: { slug: product.slug }, update: {}, create: {
      name: product.name, slug: product.slug, description: product.description, price: product.price,
      oldPrice: 'oldPrice' in product ? product.oldPrice : undefined,
      categoryId: categoryIds.get(product.category)!, material: product.material,
      care: product.category === 'aksessuary' ? 'Очищать мягкой влажной тканью. Не использовать агрессивные средства.' : 'Деликатная стирка при 30 °C. Не отбеливать. Сушить естественным образом. Перед уходом проверьте этикетку.',
      featured: product.featured,
      images: { create: [{ url: photo(product.image), alt: product.name, position: 0 }] },
      variants: { create: sizes.map((size, sizeIndex) => ({
        sku: `FRM-${String(index + 1).padStart(3, '0')}-${size.replaceAll(' ', '')}`,
        size, color: product.color, inventory: { create: { stock: sizeIndex === 0 && index % 4 === 0 ? 0 : 8 + ((index + sizeIndex) % 13) } },
      })) },
    } });
  }
  await prisma.shippingMethod.upsert({ where: { id: 'courier-kz' }, update: {}, create: {
    id: 'courier-kz', name: 'Курьерская доставка', description: 'Доставка по Казахстану до указанного адреса.', price: 2000, estimatedDays: '3–7 рабочих дней',
  } });
  await prisma.shippingMethod.upsert({ where: { id: 'pickup-almaty' }, update: {}, create: {
    id: 'pickup-almaty', name: 'Самовывоз в Алматы', description: 'Адрес и готовность заказа согласует менеджер после оформления.', price: 0, estimatedDays: '1–2 рабочих дня',
  } });
  console.log('Seed complete: 3 categories, 16 products, 2 shipping methods and 2 development accounts. Existing records were preserved.');
}

seed().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Seed failed'); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
