import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuthStore } from '../store/auth';
import { useShopStore } from '../store/shop';
import type { Cart, Category, Product, ProductVariant } from '../types';
export const useCategories = () => useQuery({queryKey:['categories'],queryFn:() => api<Category[]>('/categories'),staleTime:300_000});
export function useCart() {
  const user = useAuthStore((state) => state.user); const guest = useShopStore(); const queryClient = useQueryClient();
  const query = useQuery({queryKey:['cart',user?.id],queryFn:() => api<Cart>('/cart'),enabled:!!user});
  const cart: Cart = user ? query.data ?? {id:'',items:[],subtotal:0,itemCount:0} : {id:'guest',items:guest.items,subtotal:guest.items.reduce((sum,item)=>sum+item.total,0),itemCount:guest.items.reduce((sum,item)=>sum+item.quantity,0)};
  const update = (value: Cart) => queryClient.setQueryData(['cart',user?.id],value);
  return { ...query, cart, isLoading: !!user && query.isLoading, error: user ? query.error : null, add: async (product: Product, variant: ProductVariant, quantity = 1) => { if (user) update(await api<Cart>('/cart/items',{method:'POST',body:{variantId:variant.id,quantity}})); else guest.add(product,variant,quantity); }, setQuantity: async (id: string, quantity: number) => { if(user) update(await api<Cart>(`/cart/items/${id}`,{method:'PATCH',body:{quantity}})); else guest.setQuantity(id,quantity); }, remove: async (id: string) => { if(user) update(await api<Cart>(`/cart/items/${id}`,{method:'DELETE'})); else guest.remove(id); } };
}
export function useFavorites() {
  const user = useAuthStore((state) => state.user); const guest = useShopStore(); const queryClient = useQueryClient();
  const query = useQuery({queryKey:['favorites',user?.id],queryFn:()=>api<Product[]>('/favorites'),enabled:!!user});
  const favorites = user ? query.data ?? [] : guest.favorites;
  return {...query,favorites,isLoading:!!user && query.isLoading,error:user?query.error:null,toggle:async(product:Product)=>{ if(user) { const exists=favorites.some(item=>item.id===product.id); await api(exists?`/favorites/${product.id}`:'/favorites',{method:exists?'DELETE':'POST',body:exists?undefined:{productId:product.id}}); await queryClient.invalidateQueries({queryKey:['favorites']}); } else guest.toggleFavorite(product); }};
}
export async function mergeGuestShopping() {
  let failed = 0;
  for(const item of [...useShopStore.getState().items]) { try { await api('/cart/items',{method:'POST',body:{variantId:item.variantId,quantity:item.quantity}}); useShopStore.getState().remove(item.variantId); } catch { failed++; } }
  for(const product of [...useShopStore.getState().favorites]) { try { await api('/favorites',{method:'POST',body:{productId:product.id}}); useShopStore.getState().toggleFavorite(product); } catch { failed++; } }
  return failed;
}
