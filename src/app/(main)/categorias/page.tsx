'use client';
import { useCollection } from "@/firebase";
import { CategoryManager } from "@/components/categorias/category-manager";
import { Categoria } from "@/lib/definitions";
import { collection, orderBy, query } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export default function CategoriasPage() {
    const firestore = useFirestore();
    const { data: categorias, loading } = useCollection<Categoria>(
        firestore ? query(collection(firestore, 'categorias'), orderBy('nombre')) : null
    );

    if (loading || !firestore) {
        return <p>Cargando categorías...</p>
    }

    return (
        <>
            <CategoryManager categorias={categorias || []} />
        </>
    );
}
