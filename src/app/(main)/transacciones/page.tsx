'use client';

import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Transaction, Categoria, Account } from "@/lib/definitions";
import { TransactionsManager } from "@/components/transacciones/transactions-manager";
import { collection, query, orderBy } from "firebase/firestore";

export default function TransaccionesPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    
    const transactionsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'transactions'), orderBy('date', 'desc'));
    }, [firestore, user]);
    const { data: transactions, isLoading: loadingTransactions } = useCollection<Transaction>(transactionsQuery);

    const categoriasQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'users', user.uid, 'expenseCategories');
    }, [firestore, user]);
    const { data: categorias, isLoading: loadingCategorias } = useCollection<Categoria>(categoriasQuery);

    const accountsQuery = useMemoFirebase(() => {
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
