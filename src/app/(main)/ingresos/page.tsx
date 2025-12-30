'use client';
import { useCollection } from "@/firebase";
import { Ingreso } from "@/lib/definitions";
import { IncomeManager } from "@/components/ingresos/income-manager";
import { collection, orderBy, query } from "firebase/firestore";
import { useFirestore } from "@/firebase";


export default function IngresosPage() {
    const firestore = useFirestore();
    const { data: ingresos, loading } = useCollection<Ingreso>(
        firestore ? query(collection(firestore, 'ingresos'), orderBy('fecha', 'desc')) : null
    );

    if (loading || !firestore) {
        return <p>Cargando ingresos...</p>;
    }

    return <IncomeManager ingresos={ingresos || []} />;
}
