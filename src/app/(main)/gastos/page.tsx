'use client';

import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Gasto, Categoria } from "@/lib/definitions";
import { ExpenseManager } from "@/components/gastos/expense-manager";
import { collection, query, orderBy } from "firebase/firestore";

export default function GastosPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    
    const gastosQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `users/${user.uid}/expenses`), orderBy('date', 'desc'));
    }, [firestore, user]);
    const { data: gastos, isLoading: loadingGastos } = useCollection<Gasto>(gastosQuery);

    const categoriasQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, `users/${user.uid}/expenseCategories`);
    }, [firestore, user]);
    const { data: categorias, isLoading: loadingCategorias } = useCollection<Categoria>(categoriasQuery);
    
    if (loadingGastos || loadingCategorias || !firestore || !user) {
        return <p>Cargando datos...</p>
    }

    return <ExpenseManager gastos={gastos || []} categorias={categorias || []} userId={user.uid} />;
}
