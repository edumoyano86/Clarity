'use client';
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Account, Categoria } from "@/lib/definitions";
import { AccountsManager } from "@/components/cuentas/accounts-manager";
import { collection, query, orderBy } from "firebase/firestore";

export default function CuentasPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    
    const accountsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'accounts'), orderBy('dueDate', 'asc'));
    }, [firestore, user]);
    const { data: accounts, isLoading: loadingAccounts } = useCollection<Account>(accountsQuery);

    if (loadingAccounts || isUserLoading || !user) {
        return <p>Cargando datos...</p>
    }

    return <AccountsManager accounts={accounts || []} userId={user.uid} />;
}
