'use client';

import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Account, Transaction } from "@/lib/definitions";
import { AccountsManager } from "@/components/cuentas/accounts-manager";
import { collection, query, orderBy } from "firebase/firestore";
import { Loader2 } from "lucide-react";

export default function CuentasPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    
    const accountsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'accounts'), orderBy('dueDate', 'asc'));
    }, [firestore, user]);
    const { data: accounts, isLoading: loadingAccounts } = useCollection<Account>(accountsQuery);

    const transactionsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
    }, [firestore, user]);
    const { data: transactions, isLoading: loadingTransactions } = useCollection<Transaction>(transactionsQuery);

    if (loadingAccounts || loadingTransactions || isUserLoading || !user) {
        return (
            <div className="flex items-center justify-center min-h-[300px] text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Cargando cuentas e historial de pagos...</span>
            </div>
        );
    }

    return (
        <AccountsManager
            accounts={accounts || []}
            transactions={transactions || []}
            userId={user.uid}
        />
    );
}
