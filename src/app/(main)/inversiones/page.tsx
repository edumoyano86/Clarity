'use client';

import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Investment } from "@/lib/definitions";
import { InvestmentsManager } from "@/components/inversiones/investments-manager";
import { collection, orderBy, query } from "firebase/firestore";
import { usePortfolioHistory } from "@/hooks/use-portfolio-history";

export default function InversionesPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    
    const investmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'investments'), orderBy('purchaseDate', 'desc'));
    }, [firestore, user]);

    const { data: investments, isLoading: loadingInvestments } = useCollection<Investment>(investmentsQuery);
    const { portfolioHistory, totalValue, isLoading: isLoadingHistory } = usePortfolioHistory(investments || []);

    if (isUserLoading || loadingInvestments || !user) {
        return <p>Cargando inversiones...</p>
    }

    return <InvestmentsManager 
        investments={investments || []} 
        userId={user.uid}
        portfolioHistory={portfolioHistory}
        totalValue={totalValue}
        isLoadingHistory={isLoadingHistory}
        />;
}
