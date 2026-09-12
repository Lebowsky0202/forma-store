export interface User { id: string; email: string; name: string; phone: string | null; role: 'USER' | 'ADMIN'; createdAt: string }
export interface Category { id: string; name: string; slug: string; description?: string | null; image?: string | null; productCount?: number }
export interface ProductVariant { id: string; sku: string; size: string; color: string; stock: number }
export interface Product { id: string; name: string; slug: string; description: string; price: number; oldPrice: number | null; categoryId: string; category: Category; images: {id:string;url:string;alt:string;position:number}[]; variants: ProductVariant[]; featured: boolean; active: boolean; material: string | null; care: string | null; createdAt: string; averageRating?: number; reviewCount?: number }
export interface CartItem { id: string; variantId: string; quantity: number; variant: ProductVariant; product: Product; unitPrice: number; total: number }
export interface Cart { id: string; items: CartItem[]; subtotal: number; itemCount: number }
export interface Address { id?: string; name: string; phone: string; city: string; street: string; postalCode?: string }
export interface Order { id: string; number: string; status: string; subtotal: number; shippingCost: number; total: number; paymentMethod: string; createdAt: string; address: Address; items: {id:string;productId:string;variantId:string;name:string;sku:string;size:string;color:string;image:string;quantity:number;unitPrice:number;total:number}[]; payment?: { status: string; method: string }; shippingMethod?: { id: string; name: string } }
export interface Review { id: string; rating: number; comment: string; createdAt: string; user: { name: string } }
export interface ShippingMethod { id: string; name: string; description: string; price: number; estimatedDays: string }
export interface Page<T> { items: T[]; total: number; page: number; limit: number; pages: number }
export type AuthResponse = { user: User; accessToken: string };
