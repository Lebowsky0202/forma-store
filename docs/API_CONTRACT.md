# Shared API contract (frontend and backend agents MUST follow)

Base `/api`. Success returns the object below directly, no data wrapper. Error `{error:{code:string,message:string,details?:unknown}}`. Money integer KZT. Date ISO string. JSON camelCase. Auth access bearer JWT, refresh httpOnly cookie. Backend port 4000, frontend 5173, Vite proxies /api and /uploads. Never assume online card payment; paymentMethod `COD` only.

## Types
User `{id,email,name,phone:string|null,role:'USER'|'ADMIN',createdAt}`.
Category `{id,name,slug,description?:string|null,image?:string|null,productCount?:number}`.
Product `{id,name,slug,description,price:number,oldPrice:number|null,categoryId,category:Category,images:{id,url,alt,position:number}[],variants:{id,sku,size,color,stock:number}[],featured:boolean,active:boolean,material:string|null,care:string|null,createdAt,averageRating?:number,reviewCount?:number}`. Detail includes all; list same shape. Product inventory stock serialized flat on variant. Images may reference `/uploads/...` or https verified image source URLs.
Cart `{id,items:{id,variantId,quantity,variant:{id,sku,size,color,stock},product:Product,unitPrice:number,total:number}[],subtotal:number,itemCount:number}`.
Order `{id,number,status,subtotal,shippingCost,total,paymentMethod,createdAt,address:{name,phone,city,street,postalCode?:string},items:{id,productId,variantId,name,sku,size,color,image,quantity,unitPrice,total}[],payment?:{status,method},shippingMethod?:{id,name}}`.
Review `{id,rating,comment,createdAt,user:{name}}`.
ShippingMethod `{id,name,description,price:number,estimatedDays:string}`.
Paginated `{items:T[],total:number,page:number,limit:number,pages:number}`.

## Public / auth
- GET /health -> `{status:'ok',database:'connected'}`
- POST /auth/register `{email,password,name}` -> `{user,accessToken}` (201)
- POST /auth/login `{email,password}` -> `{user,accessToken}`
- POST /auth/refresh -> `{user,accessToken}` (cookie)
- POST /auth/logout -> `{success:true}`
- GET /auth/me -> User
- PATCH /users/me `{name,phone?}` -> User
- GET /users/me/addresses -> Address[]; POST /users/me/addresses `{name,phone,city,street,postalCode?}` -> Address; DELETE /users/me/addresses/:id
- GET /categories -> Category[]
- GET /products?search=&category=slug&minPrice=&maxPrice=&sort=newest|price_asc|price_desc|popular&inStock=true&featured=true&page=1&limit=12 -> Paginated<Product>
- GET /products/:idOrSlug -> Product
- GET /products/:id/reviews -> Review[]; POST /products/:id/reviews `{rating:1..5,comment}` -> Review (authenticated)
- GET /shipping-methods -> ShippingMethod[]

## Authenticated
- GET /cart -> Cart
- POST /cart/items `{variantId,quantity}` -> Cart (adds quantity)
- PATCH /cart/items/:id `{quantity}` -> Cart (sets)
- DELETE /cart/items/:id -> Cart; DELETE /cart -> Cart
- GET /favorites -> Product[]; POST /favorites `{productId}` -> `{success:true}`; DELETE /favorites/:productId -> `{success:true}`
- POST /orders `{address:{name,phone,city,street,postalCode?},shippingMethodId,paymentMethod:'COD'}`; header `Idempotency-Key` required -> Order
- GET /orders -> Paginated<Order>; GET /orders/:id -> Order; POST /orders/:id/cancel -> Order

## Admin (role guard on every route)
- GET /admin/stats -> `{products:number,orders:number,users:number,revenue:number,pendingOrders:number}`
- GET /admin/products -> Paginated<Product> (supports product filters + inactive)
- POST /products `{name,slug,description,price,oldPrice?,categoryId,material?,care?,featured?,active?,images:[{url,alt}],variants:[{sku,size,color,stock}]}` -> Product
- PATCH /products/:id same fields optional, images and variants replace collections, variant id preserves used variants -> Product
- DELETE /products/:id -> `{success:true}` (soft delete)
- POST /categories `{name,slug,description?,image?}` -> Category; PATCH /categories/:id same optional -> Category; DELETE /categories/:id -> `{success:true}` (409 when category in use)
- GET /admin/orders?page=&limit=&status= -> Paginated<Order>; PATCH /admin/orders/:id `{status}` -> Order
- GET /admin/users?page=&limit=&search= -> Paginated<User & {active:boolean}>; PATCH /admin/users/:id `{role?,active?}` -> User
- POST /uploads multipart `image` -> `{url:string}` (admin, validated JPEG/PNG/WebP, max 5MB)

Statuses PENDING, PROCESSING, PAID, SHIPPED, DELIVERED, CANCELLED. COD is not marked PAID at checkout. Admin transitions enforce legal workflow. Cancellation restores stock once and atomically. Request limits and pagination bounds server-side. PATCH product variants must not delete historical variants referenced by order items.
