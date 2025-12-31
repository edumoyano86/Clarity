'use client';

import { useCollection, useFirestore, useUser } from "@/firebase";
import { Gasto, Categoria } from "@/lib/definitions";
import { ExpenseManager } from "@/components/gastos/expense-manager";
import { collection, query, orderBy, where } from "firebase/firestore";
import { useMemo } from "react";

export default function GastosPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    
    const gastosQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `expenses`), where('userId', '==', user.uid), orderBy('date', 'desc'));
    }, [firestore, user]);
    const { data: gastos, isLoading: loadingGastos } = useCollection<Gasto>(gastosQuery);

    const categoriasQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `expenseCategories`), where('userId', '==', user.uid));
    }, [firestore, user]);
    const { data: categorias, isLoading: loadingCategorias } = useCollection<Categoria>(categoriasQuery);
    
    if (loadingGastos || loadingCategorias || isUserLoading) {
        return <p>Cargando datos...</p>
    }

    return <ExpenseManager gastos={gastos || []} categorias={categorias || []} userId={user!.uid} />;
}
