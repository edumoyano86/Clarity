'use client';

import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { WishlistItem, Categoria } from '@/lib/definitions';
import { WishlistManager } from '@/components/deseos/wishlist-manager';
import { collection, query, orderBy } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function DeseosPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const wishlistQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'wishlist'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);

  const { data: wishlistItems, isLoading: loadingWishlist } =
    useCollection<WishlistItem>(wishlistQuery);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'expenseCategories');
  }, [firestore, user]);

  const { data: categories, isLoading: loadingCategories } =
    useCollection<Categoria>(categoriesQuery);

  if (isUserLoading || loadingWishlist || loadingCategories || !user) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando lista de deseos...</span>
      </div>
    );
  }

  return (
    <WishlistManager
      items={wishlistItems || []}
      userId={user.uid}
      categories={categories || []}
    />
  );
}
