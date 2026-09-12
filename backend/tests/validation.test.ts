import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOrderSchema, idempotencySchema } from '../src/orders/validation.js';
import { createProductSchema, productQuerySchema } from '../src/products/validation.js';
import { imageUrlSchema } from '../src/validation.js';

const product = {
  name: 'Белая футболка', slug: 'belaya-futbolka', description: 'Базовая хлопковая футболка.', price: 10000,
  categoryId: 'clothing', images: [{ url: '/uploads/valid-image.webp', alt: 'Футболка' }],
  variants: [{ sku: 'TSHIRT-M', size: 'M', color: 'Белый', stock: 1 }],
};

test('money and inventory validation rejects fractional, negative and excessive values', () => {
  assert.equal(createProductSchema.parse(product).price, 10000);
  for (const price of [-1, 0, 0.5, 100000001, NaN, Infinity]) {
    assert.equal(createProductSchema.safeParse({ ...product, price }).success, false, `price=${price}`);
  }
  assert.equal(createProductSchema.safeParse({ ...product, oldPrice: 9999 }).success, false);
  for (const stock of [-1, 0.5, 100001, NaN, Infinity]) {
    assert.equal(createProductSchema.safeParse({ ...product, variants: [{ ...product.variants[0], stock }] }).success, false, `stock=${stock}`);
  }
  assert.equal(createProductSchema.safeParse({ ...product, variants: [...product.variants, ...product.variants] }).success, false);
});

test('image references allow safe upload paths and HTTPS without accepting executable or traversing URLs', () => {
  for (const url of ['/uploads/abc-123.webp', 'https://images.example.com/garment.jpg?width=600']) {
    assert.equal(imageUrlSchema.safeParse(url).success, true, url);
  }
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'http://example.com/image.jpg',
    'https://user:password@example.com/image.jpg', '/uploads/../.env', '/uploads/%2e%2e/private.png', '//external.example/file.png', '/uploads/file.svg']) {
    assert.equal(imageUrlSchema.safeParse(url).success, false, url);
  }
});

test('checkout requires explicit COD, bounded replay keys and server-owned totals', () => {
  const checkout = { address: { name: 'Покупатель', phone: '+77001234567', city: 'Алматы', street: 'Улица 12' }, shippingMethodId: 'courier', paymentMethod: 'COD' };
  assert.equal(createOrderSchema.safeParse(checkout).success, true);
  for (const extra of [{ total: 1 }, { subtotal: 1 }, { userId: 'another-user' }, { paymentMethod: 'CARD' }]) {
    assert.equal(createOrderSchema.safeParse({ ...checkout, ...extra }).success, false);
  }
  for (const key of ['', 'short', 'x'.repeat(101), 'unsafe key', '../../secrets']) {
    assert.equal(idempotencySchema.safeParse(key).success, false);
  }
  assert.equal(idempotencySchema.safeParse('valid-0123456789').success, true);
});

test('catalog query validation bounds expensive queries and rejects contradictory price ranges', () => {
  assert.equal(productQuerySchema.parse({}).limit, 12);
  assert.equal(productQuerySchema.parse({ page: '2', limit: '48', inStock: 'false' }).inStock, 'false');
  for (const query of [{ limit: 49 }, { page: -1 }, { page: 1.5 }, { page: 100001 }, { search: 'x'.repeat(151) },
    { minPrice: 100, maxPrice: 99 }, { inStock: 'yes' }, { sort: 'random' }]) {
    assert.equal(productQuerySchema.safeParse(query).success, false, JSON.stringify(query));
  }
});
