'use client';
import { useCollection, useFirestore, useUser } from "@/firebase";
import { CategoryManager } from "@/components/categorias/category-manager";
import { Categoria } from "@/lib/definitions";
import { collection, orderBy, query } from "firebase/firestore";
import { useMemo } from "react";

export default function CategoriasPage() {
    const firestore = useFirestore();
    const { user } = useUser();

    const categoriasQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `users/${user.uid}/expenseCategories`), orderBy('name'));
    }, [firestore, user]);

    const { data: categorias, isLoading } = useCollection<Categoria>(categoriasQuery);

    if (isLoading || !categorias) {
        return <p>Cargando categorías...</p>
    }

    return <CategoryManager categorias={categorias} userId={user!.uid} />;
}
