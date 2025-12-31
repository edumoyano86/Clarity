'use client';
import { useCollection, useFirestore, useUser } from "@/firebase";
import { Account, Categoria } from "@/lib/definitions";
import { AccountsManager } from "@/components/cuentas/accounts-manager";
import { collection, query, orderBy } from "firebase/firestore";
import { useMemo } from "react";

export default function CuentasPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    
    const accountsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'accounts'), orderBy('dueDate', 'asc'));
    }, [firestore, user]);
    const { data: accounts, isLoading: loadingAccounts } = useCollection<Account>(accountsQuery);

    if (loadingAccounts || isUserLoading || !user) {
        return <p>Cargando datos...</p>
    }

    return <AccountsManager accounts={accounts || []} userId={user.uid} />;
}
