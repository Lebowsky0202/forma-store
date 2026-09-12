import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { parse } from 'dotenv';

// Credentials are local development data. Never place them in source or output.
const env = parse(readFileSync('.env'));
const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const run = randomUUID().replaceAll('-', '');
const email = `e2e-${run}@forma.test`;
const managedEmail = `managed-${run}@forma.test`;
const uploadedImages: string[] = [];
const password = `Test-${randomUUID()}`;
const categorySlug = `e2e-${run}`;
const productSlug = `e2e-shirt-${run}`;
mkdirSync('.local/screenshots', { recursive: true });

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function loginAdmin(page: Page) {
  await page.goto('/login?redirect=/admin');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@forma.local');
  await page.getByLabel('Пароль', { exact: true }).fill(env.SEED_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Обзор', exact: false })).toBeVisible();
}

test.afterAll(async () => {
  // Clean only this run's exact IDs. Restore reserved seed stock if a test failed
  // after checkout but before its UI cancellation step.
  const users = await prisma.user.findMany({ where: { email: { in: [email, managedEmail] } } });
  for (const user of users) {
    await prisma.$transaction(async tx => {
      const orders = await tx.order.findMany({ where: { userId: user.id }, include: { items: true } });
      for (const order of orders) {
        if (['PENDING', 'PROCESSING'].includes(order.status)) {
          for (const item of order.items) await tx.inventory.update({ where: { variantId: item.variantId }, data: { stock: { increment: item.quantity } } });
        }
      }
      await tx.order.deleteMany({ where: { userId: user.id } });
      await tx.review.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });
  }
  await prisma.product.deleteMany({ where: { slug: productSlug } });
  await prisma.category.deleteMany({ where: { slug: categorySlug } });
  for (const url of uploadedImages) {
    if (!/^\/uploads\/[a-f0-9-]{36}\.webp$/.test(url)) throw new Error('Unexpected test upload path');
    await unlink(resolve('backend', env.UPLOAD_DIR || 'uploads', basename(url)));
  }
  await prisma.$disconnect();
});

async function prepareScreenshot(page: Page) {
  for (const img of await page.locator('img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`storefront and catalog fit ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('.product-card').first()).toBeVisible();
    await expect.poll(() => page.locator('.hero img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await assertNoOverflow(page);
    await prepareScreenshot(page);
    await page.screenshot({ path: `.local/screenshots/home-${width}.png`, fullPage: true });
    await page.goto('/catalog');
    await expect(page.locator('.product-card')).toHaveCount(12);
    if (width < 768) {
      await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Поиск по каталогу' })).toBeVisible();
    }
    await assertNoOverflow(page);
    await prepareScreenshot(page);
    await page.screenshot({ path: `.local/screenshots/catalog-${width}.png`, fullPage: true });
    await page.goto('/product/rubashka-iz-hlopka');
    await expect(page.getByRole('button', { name: 'В корзину', exact: true })).toBeVisible();
    await assertNoOverflow(page);
    if ([375, 1440].includes(width)) {
      await prepareScreenshot(page);
      await page.screenshot({ path: `.local/screenshots/product-${width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test('guest favorites, cart, registration, checkout, history and cancellation', async ({ page }) => {
  await page.goto('/product/rubashka-iz-hlopka');
  await page.getByRole('button', { name: 'S', exact: true }).click();
  await page.getByRole('button', { name: 'В избранное', exact: true }).click();
  await page.getByRole('button', { name: 'В корзину', exact: true }).click();
  await page.getByRole('link', { name: 'Перейти в корзину', exact: true }).click();
  await page.getByRole('button', { name: /Увеличить количество/ }).click();
  await page.reload();
  await expect(page.locator('.cart-item .quantity-control')).toContainText('2');
  await page.getByRole('link', { name: 'Перейти к оформлению' }).click();
  await page.getByRole('link', { name: 'Зарегистрироваться', exact: true }).click();
  await page.getByRole('textbox', { name: 'Ваше имя', exact: true }).fill('Тест Покупки');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByLabel('Имя получателя', { exact: true }).fill('Тест Покупки');
  await page.getByLabel('Телефон', { exact: true }).fill('+7 777 123 45 67');
  await page.getByLabel('Город', { exact: true }).fill('Алматы');
  await page.getByLabel('Улица, дом, квартира', { exact: true }).fill('Тестовая улица, дом 10');
  await page.getByRole('radio', { name: /Курьерская доставка/ }).check();
  const orderResponse = page.waitForResponse(response => response.url().endsWith('/api/orders') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click();
  const result = await orderResponse;
  expect(result.status()).toBe(201);
  const order = await result.json();
  expect(order.items[0].quantity).toBe(2);
  expect(order.payment.status).toBe('PENDING');
  await expect(page).toHaveURL(/\/order-success\//);
  await page.screenshot({ path: '.local/screenshots/order-success.png', fullPage: true });
  await page.getByRole('link', { name: 'Мои заказы', exact: true }).first().click();
  await page.getByRole('button', { name: 'Подробнее', exact: true }).click();
  await expect(page.getByText(order.number, { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Отменить заказ', exact: true }).click();
  await page.getByRole('button', { name: 'Да, отменить заказ', exact: true }).click();
  await expect(page.locator('.order-status')).toHaveText('Отменён');
  await page.goto('/favorites');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Этот раздел для администратора' })).toBeVisible();
});

test('catalog URL filters, sorting, pagination, empty state and card quick add', async ({ page }) => {
  await page.goto('/catalog');
  await expect(page.locator('.product-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.product-card')).toHaveCount(4);
  await page.getByRole('textbox', { name: 'Поиск по каталогу' }).fill('нет-такого-товара-123');
  await expect(page.getByRole('heading', { name: 'Ничего не нашлось' })).toBeVisible();
  await page.getByRole('button', { name: 'Очистить поиск' }).click();
  await page.getByLabel('Сортировка товаров').selectOption('price_asc');
  await expect(page).toHaveURL(/sort=price_asc/);
  const first = page.locator('.product-card').first();
  await expect(first.locator('.product-title')).toHaveText('Футболка из плотного хлопка');
  await first.locator('summary').click();
  const select = first.getByRole('combobox');
  const option = await select.locator('option:not([disabled])').nth(1).getAttribute('value');
  await select.selectOption(option!);
  await first.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.goto('/cart');
  await expect(page.locator('.cart-item')).toHaveCount(1);
});

test('administrator creates category and product, edits and restores hidden stock', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: '+ Добавить категорию', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill(`QA ${run}`);
  await page.getByLabel('Адрес категории (slug)', { exact: true }).fill(categorySlug);
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByText('Категория добавлена.', { exact: true })).toBeVisible();
  await page.goto('/admin/products');
  await page.getByRole('button', { name: '+ Добавить товар', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill(`QA футболка ${run}`);
  await page.getByLabel('Адрес товара (slug)', { exact: true }).fill(productSlug);
  await page.getByRole('combobox', { name: /Категория/ }).selectOption({ label: `QA ${run}` });
  await page.getByLabel('Цена, ₸', { exact: true }).fill('12500');
  await page.getByLabel('Описание', { exact: true }).fill('Хлопковая футболка для проверки работы магазина.');
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/uploads') && response.request().method() === 'POST');
  await page.getByLabel('Загрузить изображение товара').setInputFiles('backend/prisma/seed-assets/photo-1521572163474-6864f9cf17ab.jpg');
  const uploadResult = await uploaded;
  expect(uploadResult.status()).toBe(201);
  const uploadedUrl = (await uploadResult.json()).url;
  uploadedImages.push(uploadedUrl);
  await expect(page.getByLabel('Ссылка 1', { exact: true })).toHaveValue(uploadedUrl);
  await page.getByLabel('Описание изображения', { exact: true }).fill('Футболка');
  await page.getByLabel('Артикул 1', { exact: true }).fill(`QA-${run}`);
  await page.getByLabel('Цвет', { exact: true }).fill('Белый');
  await page.getByLabel('Остаток', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Сохранить товар', exact: true }).click();
  await expect(page.getByText('Товар добавлен в каталог.', { exact: true })).toBeVisible();
  await page.getByLabel('Найти товар', { exact: true }).fill(run);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const row = page.getByRole('row').filter({ hasText: `QA футболка ${run}` });
  await expect(row).toContainText('7 шт.');
  await row.getByRole('button', { name: 'Изменить', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill(`QA обновлено ${run}`);
  const patch = page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes('/api/products/'));
  await page.getByRole('button', { name: 'Сохранить товар', exact: true }).click();
  expect((await patch).postDataJSON()).not.toHaveProperty('variants');
  const changedRow = page.getByRole('row').filter({ hasText: `QA обновлено ${run}` });
  await changedRow.getByRole('button', { name: 'Скрыть', exact: true }).click();
  await changedRow.getByRole('button', { name: 'Да, скрыть', exact: true }).click();
  await expect(changedRow).toContainText('Скрыт');
  await expect(changedRow).toContainText('7 шт.');
  await changedRow.getByRole('button', { name: 'Изменить', exact: true }).click();
  await expect(page.getByLabel('Остаток', { exact: true })).toHaveValue('7');
  await page.getByLabel('Показывать в магазине', { exact: true }).check();
  await page.getByRole('button', { name: 'Сохранить товар', exact: true }).click();
  await expect(changedRow).toContainText('В продаже');
  await expect(changedRow).toContainText('7 шт.');
  await page.setViewportSize({ width: 375, height: 900 });
  await assertNoOverflow(page);
  await page.screenshot({ path: '.local/screenshots/admin-mobile.png', fullPage: true });
});

test('administrator processes a real order and disables the customer account', async ({ page, request }) => {
  const registered = await request.post('/api/auth/register', { data: { name: 'Проверка управления', email: managedEmail, password } });
  expect(registered.status()).toBe(201);
  const { accessToken } = await registered.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const product = await (await request.get('/api/products/rubashka-iz-hlopka')).json();
  const variant = product.variants.find((item: { stock: number }) => item.stock > 0);
  expect((await request.post('/api/cart/items', { headers, data: { variantId: variant.id, quantity: 1 } })).status()).toBe(200);
  const shipping = await (await request.get('/api/shipping-methods')).json();
  const created = await request.post('/api/orders', { headers: { ...headers, 'Idempotency-Key': randomUUID() }, data: {
    address: { name: 'Проверка управления', phone: '+77001234567', city: 'Алматы', street: 'Тестовая улица, 10' },
    shippingMethodId: shipping[0].id, paymentMethod: 'COD',
  } });
  expect(created.status()).toBe(201);
  const order = await created.json();
  await loginAdmin(page);
  await page.goto('/admin/orders');
  const card = page.locator('.adm-order').filter({ hasText: order.number });
  await card.getByRole('button', { name: 'Подробнее' }).click();
  await card.getByRole('combobox', { name: /Новый статус/ }).selectOption('PROCESSING');
  await card.getByRole('button', { name: 'Обновить статус' }).click();
  await expect(card.locator('.adm-badge')).toHaveText('В обработке');
  await card.getByRole('combobox', { name: /Новый статус/ }).selectOption('CANCELLED');
  await card.getByRole('button', { name: 'Обновить статус' }).click();
  await expect(card.locator('.adm-badge')).toHaveText('Отменён');
  const current = await (await request.get('/api/products/rubashka-iz-hlopka')).json();
  expect(current.variants.find((item: { id: string }) => item.id === variant.id).stock).toBe(variant.stock);
  await page.goto('/admin/users');
  await page.getByLabel('Найти пользователя', { exact: true }).fill(managedEmail);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const row = page.getByRole('row').filter({ hasText: managedEmail });
  await row.getByRole('button', { name: 'Изменить доступ' }).click();
  await row.getByLabel('Активен', { exact: true }).uncheck();
  await row.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(row).toContainText('Заблокирован');
  expect((await request.get('/api/auth/me', { headers })).status()).toBe(401);
});

test('keyboard navigation, mobile menu, form validation and missing product feedback', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Перейти к содержимому' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const menu = page.getByRole('button', { name: 'Открыть меню', exact: true });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Основное меню' })).toBeVisible();
  const catalog = page.getByRole('navigation', { name: 'Основное меню' }).getByRole('link', { name: 'Весь каталог', exact: true });
  await catalog.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/catalog$/);
  await page.goto('/register');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByText('Введите корректный email', { exact: true })).toBeVisible();
  await expect(page.getByText('Не менее 10 символов', { exact: true })).toBeVisible();
  await page.goto('/product/does-not-exist');
  await expect(page.getByRole('alert')).toContainText('Товар не найден');
  await expect(page.getByRole('link', { name: 'Вернуться в каталог' })).toBeVisible();
});
