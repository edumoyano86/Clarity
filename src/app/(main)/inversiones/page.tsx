'use client';

import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Investment } from "@/lib/definitions";
import { InvestmentsManager } from "@/components/inversiones/investments-manager";
import { collection, orderBy, query } from "firebase/firestore";
import { usePortfolioHistory, type PortfolioPeriod } from "@/hooks/use-portfolio-history";
import { useState } from "react";
import { usePrices } from "@/hooks/use-prices";

export default function InversionesPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const [period, setPeriod] = useState<PortfolioPeriod>(90);
    
    const investmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'investments'), orderBy('purchaseDate', 'desc'));
    }, [firestore, user]);

    const { data: investments, isLoading: loadingInvestments } = useCollection<Investment>(investmentsQuery);

    const { prices, isLoading: isLoadingPrices } = usePrices(investments);
    const { portfolioHistory, isLoading: isLoadingHistory, priceHistory, totalValue } = usePortfolioHistory(investments, period);
    
    const isDataLoading = isUserLoading || loadingInvestments || isLoadingPrices || isLoadingHistory;

    if (isUserLoading) {
        return <div className="flex h-full w-full items-center justify-center"><p>Cargando usuario...</p></div>
    }

    if (!user) {
        return <div className="flex h-full w-full items-center justify-center"><p>Usuario no autenticado.</p></div>
    }

    return <InvestmentsManager 
        investments={investments || []} 
        userId={user.uid}
        portfolioHistory={portfolioHistory}
        totalValue={totalValue}
        isLoading={isDataLoading}
        prices={prices}
        priceHistory={priceHistory}
        period={period}
        setPeriod={setPeriod}
        />;
}
