'use client';

import { useCollection, useFirestore, useUser } from "@/firebase";
import { Transaction, Categoria, Account } from "@/lib/definitions";
import { TransactionsManager } from "@/components/transacciones/transactions-manager";
import { collection, query, orderBy } from "firebase/firestore";
import { useMemo } from "react";

export default function TransaccionesPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    
    const transactionsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
    }, [firestore, user]);
    const { data: transactions, isLoading: loadingTransactions } = useCollection<Transaction>(transactionsQuery);

    const categoriasQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'users', user.uid, 'expenseCategories');
    }, [firestore, user]);
    const { data: categorias, isLoading: loadingCategorias } = useCollection<Categoria>(categoriasQuery);

    const accountsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'users', user.uid, 'accounts');
    }, [firestore, user]);
    const { data: accounts, isLoading: loadingAccounts } = useCollection<Account>(accountsQuery);
    
    if (loadingTransactions || loadingCategorias || loadingAccounts || isUserLoading || !user) {
        return <p>Cargando datos...</p>
    }

    return <TransactionsManager 
                transactions={transactions || []} 
                categorias={categorias || []} 
                accounts={accounts || []}
                userId={user.uid} 
            />;
}
