'use client';
import { useCollection, useFirestore, useUser } from "@/firebase";
import { Ingreso } from "@/lib/definitions";
import { IncomeManager } from "@/components/ingresos/income-manager";
import { collection, orderBy, query } from "firebase/firestore";
import { useMemo } from "react";

export default function IngresosPage() {
    const firestore = useFirestore();
    const { user } = useUser();

    const ingresosQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `users/${user.uid}/incomes`), orderBy('date', 'desc'));
    }, [firestore, user]);

    const { data: ingresos, isLoading } = useCollection<Ingreso>(ingresosQuery);

    if (isLoading || !ingresos) {
        return <p>Cargando ingresos...</p>;
    }

    return <IncomeManager ingresos={ingresos} userId={user!.uid} />;
}
