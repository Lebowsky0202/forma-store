# FORMA — интернет-магазин одежды

Демонстрационный проект для портфолио: русскоязычный магазин женской и мужской одежды и аксессуаров с ценами в тенге. Реальные PostgreSQL, API и сохранение заказов. Бренд, ассортимент, фотографии и условия доставки — примеры. Заказы в публичной демоверсии должны быть тестовыми.

## Публикация демоверсии

[Портфолио Куата — RU / EN](https://kuat-web-portfolio.abdirov32.chatgpt.site) уже опубликовано. В нём представлены описание FORMA, реальные экраны витрины и админки, стек и ссылка на исходный код. Интерактивный магазин с API и базой данных размещается отдельно; публичная демоверсия магазина пока не запущена.

Подготовлен [Render Blueprint](render.yaml) для API, интерфейса, PostgreSQL и постоянного хранения изображений. Пошаговый запуск, требования и ограничения описаны в [инструкции размещения](docs/DEPLOYMENT.md). Конфигурация использует платные ресурсы; они пока не созданы. Перед запуском владелец аккаунта должен проверить стоимость в Render.

`VITE_DEMO_MODE=true` включает отметки тестового магазина и заказов. Для самостоятельного размещения подготовлены команды `node scripts/render-build.mjs` и `node scripts/render-start.mjs`. Доступ администратора не публикуется; посетители могут создавать собственные тестовые аккаунты покупателей.

## Возможности

- Главная, категории, каталог, поиск с URL и задержкой ввода, фильтры цены/наличия, сортировка и пагинация.
- Карточка товара, фотографии, размеры/цвета, остатки, состав и уход, отзывы, похожие товары и быстрое добавление из каталога.
- Гостевые корзина и избранное сохраняются в браузере и переносятся в аккаунт после входа.
- Регистрация, вход, refresh-сессии, выход, личные данные и сохранённые адреса.
- Оформление заказа с оплатой при получении, доставка, история заказов и отмена до отправки.
- Админ-панель: обзор, товары, категории, заказы, пользователи, загрузка изображений, варианты и остатки.
- Транзакции, контроль конкурентных покупок, снимки цен, защита от повторного заказа, роли и валидация.

## Стек и структура

React 18, TypeScript, Vite, React Router, TanStack Query, Zustand, React Hook Form и Zod. Backend: Node.js, Express, Prisma 6, PostgreSQL, bcrypt и JWT. Express выбран для прозрачного модульного REST API без дополнительного каркаса. Оплата и остатки контролируются сервером.

```text
frontend/
  src/app/                 маршруты и защита страниц
  src/components/          общие элементы магазина
  src/pages/               страницы витрины и кабинета
  src/pages/admin/         административный интерфейс
  src/shared/              API, типы, состояние, валидация, UI
  src/styles/              дизайн-система и адаптивность
  Dockerfile
backend/
  src/auth/ users/ products/ categories/ cart/ favorites/
  src/orders/ reviews/ admin/ uploads/
  prisma/schema.prisma
  prisma/migrations/
  prisma/seed.ts
  tests/                   API-интеграция и unit-тесты
  Dockerfile
tests/e2e/                 сквозные браузерные проверки
scripts/                   локальная БД и настройка окружения
docs/                      контракт, архитектура и проверка
docker-compose.yml
```

Подробнее: [архитектура](docs/ARCHITECTURE.md), [контракт API](docs/API_CONTRACT.md), [план](PROJECT_PLAN.md), [результаты проверки](docs/VERIFICATION.md).

## Требования

- Node.js 22+ и npm. Проверка на этой машине: Node.js 24, Windows x64.
- Для локальной БД: `embedded-postgres` устанавливает настоящий PostgreSQL, данные хранятся в `.local/postgres`. На Windows используется штатный `pg_ctl`.
- Для Docker-запуска: Docker Engine/Desktop с Compose v2.
- Для браузерных тестов: установленный Google Chrome; можно заменить `channel` в `playwright.config.ts` на браузер вашего окружения.

## Локальный запуск

В PowerShell можно использовать `npm.cmd` вместо `npm`, если выполнение `.ps1` запрещено.

```sh
npm ci
npm run setup:env
```

Скрипт генерирует уникальные секреты и пароли, сохраняет их в исключённых из Git `.env` и `.local/credentials.md`. Существующий `.env` сохраняется; его копия синхронизируется в `backend/.env` для Prisma CLI.

В первом терминале запустите БД и оставьте его открытым:

```sh
npm run db:local
```

Во втором терминале:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Магазин: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:4000/api/health](http://localhost:4000/api/health)
- Админ-панель: [http://localhost:5173/admin](http://localhost:5173/admin)

Раздельный запуск:

```sh
npm run dev -w backend
npm run dev -w frontend
```

Остановка — Ctrl+C в терминалах. БД не удаляется. При использовании собственной PostgreSQL задайте `DATABASE_URL`, выполните `npm run setup:env` для синхронизации Prisma и пропустите `db:local`.

## Аккаунты разработки

| Роль | Email | Пароль |
|---|---|---|
| Администратор | `admin@forma.local` | `SEED_ADMIN_PASSWORD` из `.env`, также `.local/credentials.md` |
| Покупатель | `user@forma.local` | `SEED_USER_PASSWORD` из `.env`, также `.local/credentials.md` |

Паролей по умолчанию нет. Seed не перезаписывает существующие аккаунты, цены и остатки. Изменение seed-пароля в `.env` не меняет пароль уже созданного пользователя. Seed создаёт 3 категории, 16 товаров с вариантами, 2 способа доставки и 2 аккаунта.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Строка PostgreSQL для Prisma; локальный порт 55432 |
| `JWT_SECRET` | Случайный секрет JWT длиной не менее 32 символов |
| `NODE_ENV` | `development`, `test`, `production`; в production cookie Secure |
| `PORT` | Порт API, по умолчанию 4000 |
| `CORS_ORIGIN` | Разрешённый origin клиента для локального API, обычно `http://localhost:5173` |
| `UPLOAD_DIR` | Каталог изображений относительно рабочей папки API либо абсолютный путь |
| `TRUST_PROXY` | `0` локально, `1` только за одним доверенным reverse proxy |
| `SEED_ADMIN_PASSWORD` | Пароль создаваемого seed-администратора, минимум 10 символов, максимум 72 UTF-8 байта |
| `SEED_USER_PASSWORD` | Пароль создаваемого seed-покупателя |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Настройки PostgreSQL в Compose |
| `WEB_PORT` | Публикуемый порт Nginx в Compose, по умолчанию 8080 |
| `PUBLIC_ORIGIN` | Origin магазина в Docker, по умолчанию `http://localhost:8080`; задайте реальный HTTPS URL при публикации |

Секреты не должны попадать в Git, Docker image или журналы. Для ручного заполнения есть `.env.example`. Пароль PostgreSQL в Docker URL должен быть URL-безопасным; `setup:env` генерирует такой пароль автоматически.

## Docker

```sh
npm run setup:env
docker compose up --build -d
docker compose exec backend node ../node_modules/tsx/dist/cli.mjs prisma/seed.ts
```

Откройте [http://localhost:8080](http://localhost:8080). При изменении `WEB_PORT` измените и `PUBLIC_ORIGIN`. Backend автоматически применяет миграции при старте. Seed запускается явно и использует заданные переменные. Есть healthchecks и постоянные volumes БД/изображений. PostgreSQL и API доступны только внутри сети Compose.

```sh
docker compose logs -f backend
docker compose down
```

`down` сохраняет данные. Не добавляйте `-v`, если не хотите удалить volumes. Для публичного домена настройте HTTPS, `PUBLIC_ORIGIN`, резервное копирование и реальные данные продавца. Docker Engine на машине разработки отсутствовал: факт проверки контейнеров указан отдельно в отчёте, локальный запуск не подменяет проверку Docker.

## Сборка и тесты

```sh
npm run typecheck
npm run build
npm test
npm run test:e2e
npm audit
```

API-тестам нужна запущенная БД с миграциями. Браузерным тестам также нужны frontend на 5173 и backend на 4000, seed и локальный `.env`. Тесты создают уникальные данные и удаляют только свои записи; при отмене тестового заказа восстанавливаются остатки. Выполняйте наборы последовательно на среде разработки, поскольку они используют одну БД.

Скриншоты и HTML-отчёт браузерных тестов сохраняются в `.local/screenshots` и `.local/playwright-report`, диагностические файлы исключены из Git.

## API

Базовый префикс `/api`. Успешные ответы — JSON без дополнительной обёртки, ошибки — `{ "error": { "code": "...", "message": "..." } }`. Страницы списков ограничены максимум 48 записями. Access token передаётся как Bearer, refresh token — HttpOnly cookie.

| Модуль | Основные endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` |
| Каталог | `GET /products`, `/products/:idOrSlug`, `/categories`, `/shipping-methods` |
| Корзина | `GET/DELETE /cart`; `POST /cart/items`; `PATCH/DELETE /cart/items/:id` |
| Избранное | `GET/POST /favorites`; `DELETE /favorites/:productId` |
| Заказы | `GET/POST /orders`; `GET /orders/:id`; `POST /orders/:id/cancel` |
| Кабинет | `PATCH /users/me`; `GET/POST /users/me/addresses`; `DELETE /users/me/addresses/:id` |
| Отзывы | `GET/POST /products/:id/reviews` |
| Admin | `/admin/stats`, `/admin/products`, `/admin/orders`, `/admin/users`; запись товаров/категорий и `POST /uploads` |

Создание заказа требует заголовок `Idempotency-Key`. Денежные значения — целые тенге. API не принимает итоговую цену от браузера. Все операции администратора проверяют роль на сервере; знание URL не даёт доступа.

## Границы готовности к реальным продажам

Заказы, склад и аккаунты работают. Онлайн-эквайринг, email/SMS и интеграции перевозчиков не подключены; доступна оплата при получении. Для настоящего магазина владелец должен предоставить ассортимент/фотографии, цены, контакты, реквизиты, юридические условия и сервер с доменом. Здесь нет выдуманного платёжного провайдера или отправки уведомлений.

Фото из Unsplash используются как образцы наполнения, не подтверждают права FORMA на изготовление изображённых вещей; сведения о составе также являются примером каталога. [Источники изображений](docs/IMAGES.md).
