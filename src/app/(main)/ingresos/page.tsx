'use client';
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Ingreso } from "@/lib/definitions";
import { IncomeManager } from "@/components/ingresos/income-manager";
import { collection, orderBy, query } from "firebase/firestore";

export default function IngresosPage() {
    const firestore = useFirestore();
    const { user } = useUser();

    const ingresosQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `users/${user.uid}/incomes`), orderBy('date', 'desc'));
    }, [firestore, user]);

    const { data: ingresos, isLoading } = useCollection<Ingreso>(ingresosQuery);

    if (isLoading || !user) {
        return <p>Cargando ingresos...</p>;
    }

    return <IncomeManager ingresos={ingresos || []} userId={user.uid} />;
}
