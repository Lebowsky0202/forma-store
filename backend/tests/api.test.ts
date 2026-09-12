import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import request, { type Response } from 'supertest';
import sharp from 'sharp';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/db.js';
import { hashPassword, hashToken } from '../src/auth/service.js';

// Every record belongs to this run. The seed and existing customer data are never reset.
const run = randomUUID().replaceAll('-', '');
const password = `Test-${run}`;
const userIds: string[] = [];
const productIds: string[] = [];
const categoryIds: string[] = [];
const uploadFiles: string[] = [];
let adminToken: string;
let userToken: string;
let otherToken: string;
let userId: string;
let categoryId: string;
let shippingId: string;
let productId: string;
let variantId: string;
let productSlug: string;
const userEmail = `api-${run}@example.test`;
const otherEmail = `other-${run}@example.test`;
const address = { name: 'Тестовый покупатель', phone: '+77001234567', city: 'Алматы', street: 'Тестовая улица, 12', postalCode: '050000' };
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const cookie = (response: Response) => {
  const values = response.headers['set-cookie'];
  const first = typeof values === 'string' ? values : values?.[0];
  assert.ok(first, 'Session response must set its refresh cookie');
  return first.split(';')[0]!;
};
const checkout = (token: string, key = randomUUID()) => request(app).post('/api/orders').set(auth(token))
  .set('Idempotency-Key', key).send({ address, shippingMethodId: shippingId, paymentMethod: 'COD' });

async function fixtureProduct(label: string, stock: number, price = 12000) {
  const response = await request(app).post('/api/products').set(auth(adminToken)).send({
    name: `Проверка ${label} ${run}`, slug: `test-${label}-${run}`, description: 'Тестовый товар для интеграционной проверки.',
    price, categoryId, material: 'Хлопок', images: [{ url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab', alt: 'Тестовая одежда' }],
    variants: [{ sku: `${label}-${run}`, size: 'M', color: 'Белый', stock }],
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  productIds.push(response.body.id as string);
  return response.body as { id: string; slug: string; variants: { id: string; sku: string; size: string; color: string; stock: number }[] };
}

before(async () => {
  await prisma.$connect();
  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.create({ data: { email: `admin-${run}@example.test`, name: 'Тестовый администратор', passwordHash, role: 'ADMIN', cart: { create: {} } } });
  userIds.push(admin.id);
  const other = await prisma.user.create({ data: { email: otherEmail, name: 'Другой покупатель', passwordHash, cart: { create: {} } } });
  userIds.push(other.id);
  const adminLogin = await request(app).post('/api/auth/login').send({ email: admin.email, password }).expect(200);
  adminToken = adminLogin.body.accessToken as string;
  const otherLogin = await request(app).post('/api/auth/login').send({ email: other.email, password }).expect(200);
  otherToken = otherLogin.body.accessToken as string;
  const category = await request(app).post('/api/categories').set(auth(adminToken)).send({ name: `Тест ${run}`, slug: `test-${run}` }).expect(201);
  categoryId = category.body.id as string;
  categoryIds.push(categoryId);
  const shipping = await prisma.shippingMethod.create({ data: { name: `Тестовая доставка ${run}`, description: 'Только интеграционный тест', price: 1500, estimatedDays: '1 день' } });
  shippingId = shipping.id;
  const product = await fixtureProduct('main', 5);
  productId = product.id;
  productSlug = product.slug;
  variantId = product.variants[0]!.id;
});

after(async () => {
  try {
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.review.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    if (shippingId) await prisma.shippingMethod.delete({ where: { id: shippingId } });
    await Promise.all(uploadFiles.map((filename) => unlink(path.join(config.uploadDir, filename))));
  } finally { await prisma.$disconnect(); }
});

test('health verifies a live PostgreSQL connection', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.deepEqual(response.body, { status: 'ok', database: 'connected' });
});

test('registration validates input, hashes passwords, rejects duplicate accounts and role injection', async () => {
  await request(app).post('/api/auth/register').send({ email: userEmail, name: 'Покупатель', password, role: 'ADMIN' }).expect(400);
  await request(app).post('/api/auth/register').send({ email: userEmail, name: 'Покупатель', password: 'short' }).expect(400);
  const response = await request(app).post('/api/auth/register').send({ email: userEmail.toUpperCase(), name: 'Покупатель', password }).expect(201);
  userId = response.body.user.id as string;
  userIds.push(userId);
  userToken = response.body.accessToken as string;
  assert.equal(response.body.user.role, 'USER');
  assert.equal(response.body.user.email, userEmail);
  assert.equal(response.body.user.passwordHash, undefined);
  const saved = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.notEqual(saved.passwordHash, password);
  assert.match(saved.passwordHash, /^\$2[aby]\$/);
  const rawRefresh = cookie(response).split('=')[1]!;
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawRefresh) } });
  assert.ok(stored);
  await request(app).post('/api/auth/register').send({ email: userEmail, name: 'Покупатель', password }).expect(409);
  await request(app).post('/api/auth/login').send({ email: userEmail, password: 'incorrect-password' }).expect(401);
  await request(app).get('/api/auth/me').set(auth(userToken)).expect(200);
});

test('refresh tokens rotate, replay revokes the family, and logout revokes refresh access', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: userEmail, password }).expect(200);
  const originalCookie = cookie(login);
  const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie).expect(200);
  const replacementCookie = cookie(refreshed);
  assert.notEqual(replacementCookie, originalCookie);
  await request(app).post('/api/auth/refresh').set('Cookie', originalCookie).expect(401);
  await request(app).post('/api/auth/refresh').set('Cookie', replacementCookie).expect(401);
  const newLogin = await request(app).post('/api/auth/login').send({ email: userEmail, password }).expect(200);
  await request(app).post('/api/auth/logout').set('Cookie', cookie(newLogin)).expect(200);
  await request(app).post('/api/auth/refresh').set('Cookie', cookie(newLogin)).expect(401);
});

test('authorization protects every admin resource and rejects invalid origins and JWTs', async () => {
  for (const route of ['/api/admin/stats', '/api/admin/products', '/api/admin/orders', '/api/admin/users']) {
    await request(app).get(route).expect(401);
    await request(app).get(route).set(auth(userToken)).expect(403);
  }
  await request(app).post('/api/products').set(auth(userToken)).send({}).expect(403);
  await request(app).post('/api/categories').set(auth(userToken)).send({}).expect(403);
  await request(app).patch(`/api/admin/users/${userId}`).set(auth(userToken)).send({ role: 'ADMIN' }).expect(403);
  await request(app).get('/api/auth/me').set(auth('forged-token')).expect(401);
  await request(app).patch('/api/users/me').set(auth(userToken)).set('Origin', 'https://unexpected.example').send({ name: 'Изменённое имя' }).expect(403);
  await request(app).patch('/api/users/me').set(auth(userToken)).send({ name: 'Изменённое имя', role: 'ADMIN' }).expect(400);
});

test('catalog filters, search, pagination and stock constraints use persisted products', async () => {
  await fixtureProduct('empty', 0, 8000);
  const response = await request(app).get('/api/products').query({ category: `test-${run}`, sort: 'price_asc', limit: 1 }).expect(200);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.pages, 2);
  assert.equal(response.body.items[0].price, 8000);
  const filtered = await request(app).get('/api/products').query({ category: `test-${run}`, inStock: 'true', minPrice: 9000, maxPrice: 13000 }).expect(200);
  assert.equal(filtered.body.total, 1);
  assert.equal(filtered.body.items[0].id, productId);
  const searched = await request(app).get('/api/products').query({ search: `main ${run}` }).expect(200);
  assert.equal(searched.body.items[0].id, productId);
  await request(app).get(`/api/products/${productSlug}`).expect(200);
  await request(app).get('/api/products').query({ page: 0 }).expect(400);
  await request(app).get('/api/products').query({ limit: 100000 }).expect(400);
  await request(app).get('/api/products').query({ minPrice: 15000, maxPrice: 5000 }).expect(400);
});

test('cart enforces quantity, stock and ownership; totals always use current server prices', async () => {
  await request(app).post('/api/cart/items').set(auth(userToken)).send({ variantId, quantity: -1 }).expect(400);
  await request(app).post('/api/cart/items').set(auth(userToken)).send({ variantId, quantity: 1, unitPrice: 1 }).expect(400);
  const first = await request(app).post('/api/cart/items').set(auth(userToken)).send({ variantId, quantity: 1 }).expect(200);
  const itemId = first.body.items[0].id as string;
  const second = await request(app).post('/api/cart/items').set(auth(userToken)).send({ variantId, quantity: 1 }).expect(200);
  assert.equal(second.body.itemCount, 2);
  assert.equal(second.body.subtotal, 24000);
  await request(app).patch(`/api/cart/items/${itemId}`).set(auth(otherToken)).send({ quantity: 1 }).expect(404);
  await request(app).delete(`/api/cart/items/${itemId}`).set(auth(otherToken)).expect(404);
  await request(app).patch(`/api/cart/items/${itemId}`).set(auth(userToken)).send({ quantity: 6 }).expect(409);
  const cart = await request(app).get('/api/cart').set(auth(userToken)).expect(200);
  assert.equal(cart.body.items[0].quantity, 2);
});

test('favorites, reviews and addresses persist and enforce ownership and validation', async () => {
  await request(app).post('/api/favorites').set(auth(userToken)).send({ productId }).expect(200);
  await request(app).post('/api/favorites').set(auth(userToken)).send({ productId }).expect(200);
  const favorites = await request(app).get('/api/favorites').set(auth(userToken)).expect(200);
  assert.equal(favorites.body.length, 1);
  await request(app).delete(`/api/favorites/${productId}`).set(auth(userToken)).expect(200);
  assert.equal((await request(app).get('/api/favorites').set(auth(userToken))).body.length, 0);
  await request(app).post(`/api/products/${productId}/reviews`).set(auth(userToken)).send({ rating: 6, comment: 'Хорошая ткань' }).expect(400);
  await request(app).post(`/api/products/${productId}/reviews`).set(auth(userToken)).send({ rating: 5, comment: 'Хорошая ткань' }).expect(201);
  await request(app).post(`/api/products/${productId}/reviews`).set(auth(userToken)).send({ rating: 4, comment: 'Второй отзыв' }).expect(409);
  const detail = await request(app).get(`/api/products/${productId}`).expect(200);
  assert.equal(detail.body.averageRating, 5);
  assert.equal(detail.body.reviewCount, 1);
  const saved = await request(app).post('/api/users/me/addresses').set(auth(userToken)).send(address).expect(201);
  await request(app).delete(`/api/users/me/addresses/${saved.body.id}`).set(auth(otherToken)).expect(404);
  const addresses = await request(app).get('/api/users/me/addresses').set(auth(userToken)).expect(200);
  assert.equal(addresses.body[0].street, address.street);
  await request(app).delete(`/api/users/me/addresses/${saved.body.id}`).set(auth(userToken)).expect(200);
});

test('checkout snapshots prices, clears cart, replays idempotently and restores stock once', async () => {
  const body = { address, shippingMethodId: shippingId, paymentMethod: 'COD' };
  await request(app).post('/api/orders').set(auth(userToken)).send(body).expect(400);
  await request(app).post('/api/orders').set(auth(userToken)).set('Idempotency-Key', randomUUID()).send({ ...body, total: 1 }).expect(400);
  const key = randomUUID();
  const placed = await checkout(userToken, key).expect(201);
  assert.equal(placed.body.subtotal, 24000);
  assert.equal(placed.body.total, 25500);
  assert.equal(placed.body.payment.status, 'PENDING');
  assert.equal(placed.body.status, 'PENDING');
  assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).stock, 3);
  assert.equal((await request(app).get('/api/cart').set(auth(userToken))).body.items.length, 0);
  assert.equal((await checkout(userToken, key).expect(201)).body.id, placed.body.id);
  await request(app).post('/api/orders').set(auth(userToken)).set('Idempotency-Key', key).send({ ...body, address: { ...address, city: 'Астана' } }).expect(409);
  await request(app).get(`/api/orders/${placed.body.id}`).set(auth(otherToken)).expect(404);
  await request(app).post(`/api/orders/${placed.body.id}/cancel`).set(auth(otherToken)).expect(404);
  await request(app).patch(`/api/products/${productId}`).set(auth(adminToken)).send({ price: 13000, name: 'Название после заказа' }).expect(200);
  const order = await request(app).get(`/api/orders/${placed.body.id}`).set(auth(userToken)).expect(200);
  assert.equal(order.body.items[0].unitPrice, 12000);
  assert.notEqual(order.body.items[0].name, 'Название после заказа');
  const cancellations = await Promise.all([
    request(app).post(`/api/orders/${placed.body.id}/cancel`).set(auth(userToken)),
    request(app).post(`/api/orders/${placed.body.id}/cancel`).set(auth(userToken)),
  ]);
  assert.deepEqual(cancellations.map((result) => result.status), [200, 200]);
  assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).stock, 5);
  assert.equal(cancellations[0]!.body.payment.status, 'CANCELLED');
});

test('concurrent customers cannot buy the same last unit', async () => {
  const product = await fixtureProduct('race', 1);
  const id = product.variants[0]!.id;
  await request(app).post('/api/cart/items').set(auth(userToken)).send({ variantId: id, quantity: 1 }).expect(200);
  await request(app).post('/api/cart/items').set(auth(otherToken)).send({ variantId: id, quantity: 1 }).expect(200);
  const responses = await Promise.all([checkout(userToken), checkout(otherToken)]);
  assert.deepEqual(responses.map((result) => result.status).sort(), [201, 409]);
  assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { variantId: id } })).stock, 0);
  const orders = await prisma.orderItem.findMany({ where: { variantId: id } });
  assert.equal(orders.length, 1);
  await request(app).delete('/api/cart').set(auth(userToken)).expect(200);
  await request(app).delete('/api/cart').set(auth(otherToken)).expect(200);
});

test('simultaneous retries with one idempotency key create exactly one order', async () => {
  const product = await fixtureProduct('retry', 3);
  const id = product.variants[0]!.id;
  await request(app).post('/api/cart/items').set(auth(userToken)).send({ variantId: id, quantity: 1 }).expect(200);
  const key = randomUUID();
  const responses = await Promise.all([checkout(userToken, key), checkout(userToken, key)]);
  assert.deepEqual(responses.map((result) => result.status), [201, 201], JSON.stringify(responses.map((result) => result.body)));
  assert.equal(responses[0]!.body.id, responses[1]!.body.id);
  assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { variantId: id } })).stock, 2);
  assert.equal(await prisma.order.count({ where: { userId, idempotencyKey: key } }), 1);
});

test('admin order workflow guards transitions and keeps archived variants in historical orders', async () => {
  const product = await fixtureProduct('workflow', 4);
  const originalVariant = product.variants[0]!;
  await request(app).post('/api/cart/items').set(auth(userToken)).send({ variantId: originalVariant.id, quantity: 1 }).expect(200);
  const placed = await checkout(userToken).expect(201);
  await request(app).patch(`/api/admin/orders/${placed.body.id}`).set(auth(adminToken)).send({ status: 'DELIVERED' }).expect(409);
  await request(app).patch(`/api/admin/orders/${placed.body.id}`).set(auth(adminToken)).send({ status: 'PROCESSING' }).expect(200);
  await request(app).patch(`/api/admin/orders/${placed.body.id}`).set(auth(adminToken)).send({ status: 'SHIPPED' }).expect(200);
  await request(app).post(`/api/orders/${placed.body.id}/cancel`).set(auth(userToken)).expect(409);
  const delivered = await request(app).patch(`/api/admin/orders/${placed.body.id}`).set(auth(adminToken)).send({ status: 'DELIVERED' }).expect(200);
  assert.equal(delivered.body.payment.status, 'PAID');
  await request(app).patch(`/api/products/${product.id}`).set(auth(adminToken)).send({ variants: [{ sku: `new-${run}`, size: 'L', color: 'Белый', stock: 2 }] }).expect(200);
  assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: originalVariant.id } })).active, false);
  const historical = await request(app).get(`/api/orders/${placed.body.id}`).set(auth(userToken)).expect(200);
  assert.equal(historical.body.items[0].sku, originalVariant.sku);
  assert.equal(historical.body.items[0].variantId, originalVariant.id);
});

test('admin hides and restores products without erasing inventory and protects referenced categories', async () => {
  await request(app).delete(`/api/products/${productId}`).set(auth(adminToken)).expect(200);
  await request(app).get(`/api/products/${productId}`).expect(404);
  const adminProducts = await request(app).get('/api/admin/products').set(auth(adminToken)).query({ category: `test-${run}`, active: 'false' }).expect(200);
  const hidden = adminProducts.body.items.find((product: { id: string }) => product.id === productId) as { variants: { id: string; sku: string; size: string; color: string; stock: number }[] };
  assert.ok(hidden);
  assert.equal(hidden.variants[0]!.stock, 5);
  await request(app).patch(`/api/products/${productId}`).set(auth(adminToken)).send({ active: true, variants: hidden.variants }).expect(200);
  assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).stock, 5);
  await request(app).delete(`/api/categories/${categoryId}`).set(auth(adminToken)).expect(409);
  await request(app).patch(`/api/products/${productId}`).set(auth(adminToken)).send({ price: -1 }).expect(400);
  await request(app).patch(`/api/products/${productId}`).set(auth(adminToken)).send({ images: [{ url: 'javascript:alert(1)', alt: 'Неверный URL' }] }).expect(400);
});

test('upload validates decoded image content, limits size and only accepts admins', async () => {
  const png = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#183d32' } }).png().toBuffer();
  await request(app).post('/api/uploads').set(auth(userToken)).attach('image', png, { filename: 'image.png', contentType: 'image/png' }).expect(403);
  await request(app).post('/api/uploads').set(auth(adminToken)).attach('image', Buffer.from('<script>bad</script>'), { filename: 'fake.png', contentType: 'image/png' }).expect(400);
  await request(app).post('/api/uploads').set(auth(adminToken)).attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.jpg', contentType: 'image/jpeg' }).expect(400);
  const uploaded = await request(app).post('/api/uploads').set(auth(adminToken)).attach('image', png, { filename: '../../untrusted.png', contentType: 'image/png' }).expect(201);
  assert.match(uploaded.body.url as string, /^\/uploads\/[0-9a-f-]+\.webp$/);
  uploadFiles.push(path.basename(uploaded.body.url as string));
  const result = await request(app).get(uploaded.body.url as string).expect(200);
  assert.match(result.headers['content-type'] as string, /image\/webp/);
  const metadata = await sharp(result.body as Buffer).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 24);
});

test('changing roles or disabling a user invalidates their existing session immediately', async () => {
  const other = await prisma.user.findUniqueOrThrow({ where: { email: otherEmail } });
  await request(app).patch(`/api/admin/users/${other.id}`).set(auth(adminToken)).send({ role: 'ADMIN' }).expect(200);
  await request(app).get('/api/admin/stats').set(auth(otherToken)).expect(401);
  const promoted = await request(app).post('/api/auth/login').send({ email: otherEmail, password }).expect(200);
  await request(app).get('/api/admin/stats').set(auth(promoted.body.accessToken as string)).expect(200);
  await request(app).patch(`/api/admin/users/${other.id}`).set(auth(adminToken)).send({ role: 'USER', active: false }).expect(200);
  await request(app).get('/api/auth/me').set(auth(promoted.body.accessToken as string)).expect(401);
  await request(app).post('/api/auth/refresh').set('Cookie', cookie(promoted)).expect(401);
  await request(app).post('/api/auth/login').send({ email: otherEmail, password }).expect(401);
  const adminMe = await request(app).get('/api/auth/me').set(auth(adminToken)).expect(200);
  await request(app).patch(`/api/admin/users/${adminMe.body.id}`).set(auth(adminToken)).send({ active: false }).expect(409);
});
