import { useFavorites } from '../shared/api/queries';
import { Breadcrumbs, EmptyState, ErrorState, Loading } from '../shared/ui';
import { ProductGrid } from '../components/ProductCard';
export default function FavoritesPage(){const {favorites,isLoading,error,refetch}=useFavorites();return <div className="container page-space"><Breadcrumbs items={[{label:'Избранное'}]}/><div className="page-title-row"><h1>Самое любимое<span className="heading-dot">.</span></h1><span className="muted">{favorites.length} товаров</span></div>{isLoading?<Loading/>:error?<ErrorState error={error} retry={()=>refetch()}/>:favorites.length?<ProductGrid products={favorites}/>:<EmptyState title="Сохраняйте то, что нравится" description="Нажмите на сердечко у товара, и он появится здесь."/>}</div>;}
