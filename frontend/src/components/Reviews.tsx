import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { api } from '../shared/api/client';
import { useAuthStore } from '../shared/store/auth';
import type { Review } from '../shared/types';
import { Alert, Button, ErrorState, Field, Loading } from '../shared/ui';
const reviewSchema=z.object({rating:z.coerce.number().int().min(1).max(5),comment:z.string().trim().min(10,'Напишите не менее 10 символов').max(2000,'Не более 2000 символов')});
export default function Reviews({productId,slug}:{productId:string;slug:string}){
  const user=useAuthStore(s=>s.user);const client=useQueryClient();const reviews=useQuery({queryKey:['reviews',productId],queryFn:()=>api<Review[]>(`/products/${productId}/reviews`)});
  const {register,handleSubmit,reset,formState:{errors}}=useForm<z.infer<typeof reviewSchema>>({resolver:zodResolver(reviewSchema),defaultValues:{rating:5,comment:''}});
  const add=useMutation({mutationFn:(body:z.infer<typeof reviewSchema>)=>api(`/products/${productId}/reviews`,{method:'POST',body}),onSuccess:()=>{reset();client.invalidateQueries({queryKey:['reviews',productId]});client.invalidateQueries({queryKey:['product',slug]});}});
  return <section className="reviews-section"><div className="section-heading"><h2>Отзывы <span className="count-label">{reviews.data?.length??0}</span></h2></div><div className="reviews-layout"><div>{reviews.isLoading?<Loading/>:reviews.error?<ErrorState error={reviews.error}/>:reviews.data?.length?reviews.data.map(review=><article className="review" key={review.id}><div className="review-top"><strong>{review.user.name}</strong><time>{new Date(review.createdAt).toLocaleDateString('ru-RU')}</time></div><div className="stars" aria-label={`${review.rating} из 5`}>{Array.from({length:5},(_,i)=><Star key={i} size={14} fill={i<review.rating?'currentColor':'none'}/>)}</div><p>{review.comment}</p></article>):<div className="soft-panel"><h3>Первое впечатление — за вами</h3><p>У этого товара пока нет отзывов. Поделитесь своим мнением после покупки.</p></div>}</div><div className="review-form">{user?<form onSubmit={handleSubmit(data=>add.mutate(data))}><h3>Ваш отзыв</h3><Field label="Оценка" error={errors.rating?.message}><select {...register('rating')}><option value="5">5 — Отлично</option><option value="4">4 — Хорошо</option><option value="3">3 — Нормально</option><option value="2">2 — Не понравилось</option><option value="1">1 — Плохо</option></select></Field><Field label="Впечатления о товаре" error={errors.comment?.message}><textarea rows={4} placeholder="Как вам посадка, ткань и качество?" {...register('comment')}/></Field>{add.error&&<Alert>{add.error.message}</Alert>}{add.isSuccess&&<Alert success>Спасибо! Ваш отзыв опубликован.</Alert>}<Button disabled={add.isPending}>{add.isPending?'Публикуем…':'Оставить отзыв'}</Button></form>:<div className="soft-panel"><h3>Есть что сказать?</h3><p>Войдите, чтобы оставить отзыв о покупке.</p><Link to={`/login?redirect=/product/${slug}`} className="button secondary">Войти в аккаунт</Link></div>}</div></div></section>;
}
