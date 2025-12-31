'use client';
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { CategoryManager } from "@/components/categorias/category-manager";
import { Categoria } from "@/lib/definitions";
import { collection, orderBy, query } from "firebase/firestore";

export default function CategoriasPage() {
    const firestore = useFirestore();
    const { user } = useUser();

    const categoriasQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `users/${user.uid}/expenseCategories`), orderBy('name'));
    }, [firestore, user]);

    const { data: categorias, isLoading } = useCollection<Categoria>(categoriasQuery);

    if (isLoading || !user) {
        return <p>Cargando categorías...</p>
    }

    return (
        <>
            <CategoryManager categorias={categorias || []} userId={user.uid} />
        </>
    );
}
