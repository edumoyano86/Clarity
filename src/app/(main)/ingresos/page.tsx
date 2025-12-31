'use client';
import { useCollection, useFirestore, useUser } from "@/firebase";
import { Ingreso } from "@/lib/definitions";
import { IncomeManager } from "@/components/ingresos/income-manager";
import { collection } from "firebase/firestore";
import { useMemo } from "react";

export default function IngresosPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();

    const ingresosQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'users', user.uid, 'incomes');
    }, [firestore, user]);

    const { data: ingresos, isLoading: loadingIngresos } = useCollection<Ingreso>(ingresosQuery);

    if (isUserLoading || loadingIngresos || !user) {
        return <p>Cargando ingresos...</p>;
    }

    return <IncomeManager ingresos={ingresos || []} userId={user.uid} />;
}
