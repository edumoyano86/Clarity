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
    const { portfolioHistory, totalValue, isLoading: isLoadingHistory, priceHistory } = usePortfolioHistory(investments, period, prices);

    const isLoading = isUserLoading || loadingInvestments || (!!investments && investments.length > 0 && (isLoadingPrices || isLoadingHistory));

    if (isUserLoading || !user) {
        return <div className="flex h-full w-full items-center justify-center"><p>Cargando usuario...</p></div>
    }

    return <InvestmentsManager 
        investments={investments || []} 
        userId={user.uid}
        portfolioHistory={portfolioHistory}
        totalValue={totalValue}
        isLoading={isLoading}
        prices={prices}
        priceHistory={priceHistory}
        period={period}
        setPeriod={setPeriod}
        />;
}
