'use client';
import { useCollection, useFirestore, useUser } from "@/firebase";
import { Ingreso } from "@/lib/definitions";
import { IncomeManager } from "@/components/ingresos/income-manager";
import { collection, orderBy, query, where } from "firebase/firestore";
import { useMemo } from "react";
import { FirebaseProvider } from "@/firebase/provider";

function IngresosPageContent() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();

    const ingresosQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'incomes'), where('userId', '==', user.uid), orderBy('date', 'desc'));
    }, [firestore, user]);

    const { data: ingresos, isLoading: loadingIngresos } = useCollection<Ingreso>(ingresosQuery);

    if (isUserLoading || loadingIngresos) {
        return <p>Cargando ingresos...</p>;
    }

    return <IncomeManager ingresos={ingresos || []} userId={user!.uid} />;
}

export default function IngresosPage() {
    return (
        <FirebaseProvider>
            <IngresosPageContent />
        </FirebaseProvider>
    )
}
