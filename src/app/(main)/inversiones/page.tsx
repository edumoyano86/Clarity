'use client';

import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Investment } from "@/lib/definitions";
import { InvestmentsManager } from "@/components/inversiones/investments-manager";
import { collection, orderBy, query } from "firebase/firestore";
import { usePortfolioHistory, type PortfolioPeriod } from "@/hooks/use-portfolio-history";
import { useState } from "react";

export default function InversionesPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const [period, setPeriod] = useState<PortfolioPeriod>(90);
    
    const investmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'investments'), orderBy('purchaseDate', 'desc'));
    }, [firestore, user]);

    const { data: investments, isLoading: loadingInvestments } = useCollection<Investment>(investmentsQuery);
    const { portfolioHistory, totalValue, isLoading: isLoadingHistory, priceHistory } = usePortfolioHistory(investments || [], period);

    if (isUserLoading || !user) {
        return <p>Cargando inversiones...</p>
    }

    return <InvestmentsManager 
        investments={investments || []} 
        userId={user.uid}
        portfolioHistory={portfolioHistory}
        totalValue={totalValue}
        isLoadingHistory={loadingInvestments || isLoadingHistory}
        period={period}
        setPeriod={setPeriod}
        priceHistory={priceHistory}
        />;
}
