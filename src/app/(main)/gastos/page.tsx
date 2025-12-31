'use client';

import { useCollection, useFirestore, useUser } from "@/firebase";
import { Gasto, Categoria } from "@/lib/definitions";
import { ExpenseManager } from "@/components/gastos/expense-manager";
import { collection, query, orderBy } from "firebase/firestore";
import { useMemo } from "react";

export default function GastosPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    
    const gastosQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `users/${user.uid}/expenses`), orderBy('date', 'desc'));
    }, [firestore, user]);
    const { data: gastos, isLoading: loadingGastos } = useCollection<Gasto>(gastosQuery);

    const categoriasQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return collection(firestore, `users/${user.uid}/expenseCategories`);
    }, [firestore, user]);
    const { data: categorias, isLoading: loadingCategorias } = useCollection<Categoria>(categoriasQuery);
    
    if (loadingGastos || loadingCategorias || !gastos || !categorias) {
        return <p>Cargando datos...</p>
    }

    return <ExpenseManager gastos={gastos} categorias={categorias} userId={user!.uid} />;
}
