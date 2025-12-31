'use client';

import { useCollection, useFirestore, useUser } from "@/firebase";
import { Investment } from "@/lib/definitions";
import { InvestmentsManager } from "@/components/inversiones/investments-manager";
import { collection, orderBy, query } from "firebase/firestore";
import { useMemo } from "react";

export default function InversionesPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    
    const investmentsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'investments'), orderBy('purchaseDate', 'desc'));
    }, [firestore, user]);

    const { data: investments, isLoading: loadingInvestments } = useCollection<Investment>(investmentsQuery);

    if (isUserLoading || loadingInvestments || !user) {
        return <p>Cargando inversiones...</p>
    }

    return <InvestmentsManager investments={investments || []} userId={user.uid} />;
}
