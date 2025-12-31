'use client';
import { useCollection, useFirestore, useUser } from "@/firebase";
import { CategoryManager } from "@/components/categorias/category-manager";
import { Categoria } from "@/lib/definitions";
import { collection } from "firebase/firestore";
import { useMemo } from "react";

export default function CategoriasPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();

    const categoriasQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'users', user.uid, 'expenseCategories');
    }, [firestore, user]);

    const { data: categorias, isLoading: loadingCategorias } = useCollection<Categoria>(categoriasQuery);

    if (isUserLoading || loadingCategorias || !user) {
        return <p>Cargando categorías...</p>
    }

    return <CategoryManager categorias={categorias || []} userId={user.uid} />;
}
