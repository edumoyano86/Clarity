'use client';

import { useCollection } from "@/firebase";
import { Gasto, Categoria } from "@/lib/definitions";
import { ExpenseManager } from "@/components/gastos/expense-manager";
import { collection, query, orderBy } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export default function GastosPage() {
    const firestore = useFirestore();
    
    const { data: gastos, loading: loadingGastos } = useCollection<Gasto>(
        firestore ? query(collection(firestore, 'gastos'), orderBy('fecha', 'desc')) : null
    );

    const { data: categorias, loading: loadingCategorias } = useCollection<Categoria>(
        firestore ? collection(firestore, 'categorias') : null
    );
    
    if (loadingGastos || loadingCategorias || !firestore) {
        return <p>Cargando datos...</p>
    }

    return <ExpenseManager gastos={gastos || []} categorias={categorias || []} />;
}
