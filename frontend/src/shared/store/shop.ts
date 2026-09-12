import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, ProductVariant } from '../types';
type ShopState = { items: CartItem[]; favorites: Product[]; add: (product: Product, variant: ProductVariant, quantity: number) => void; setQuantity: (variantId: string, quantity: number) => void; remove: (variantId: string) => void; toggleFavorite: (product: Product) => void };
export const useShopStore = create<ShopState>()(persist((set) => ({ items: [], favorites: [], add: (product, variant, quantity) => set((state) => {
  const current = state.items.find((item) => item.variantId === variant.id);
  const count = Math.min(variant.stock, (current?.quantity ?? 0) + quantity);
  const item: CartItem = { id: variant.id, variantId: variant.id, quantity: count, variant, product, unitPrice: product.price, total: product.price * count };
  return { items: [...state.items.filter((entry) => entry.variantId !== variant.id), item] };
}), setQuantity: (variantId, quantity) => set((state) => ({items: state.items.map((item) => item.variantId === variantId ? {...item,quantity,total:item.unitPrice*quantity} : item)})), remove: (variantId) => set((state) => ({items:state.items.filter((item) => item.variantId !== variantId)})), toggleFavorite: (product) => set((state) => ({ favorites: state.favorites.some((item) => item.id === product.id) ? state.favorites.filter((item) => item.id !== product.id) : [...state.favorites,product] })) }), { name: 'forma-shopping-v1' }));
export const useToastStore = create<{message: string; show: (message: string) => void; clear: () => void}>((set) => ({message: '',show: (message) => set({message}),clear: () => set({message:''})}));
