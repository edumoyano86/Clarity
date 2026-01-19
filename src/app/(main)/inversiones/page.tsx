'use client';

import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Investment } from "@/lib/definitions";
import { InvestmentsManager } from "@/components/inversiones/investments-manager";
import { collection, orderBy, query } from "firebase/firestore";
import { usePortfolioHistory } from "@/hooks/use-portfolio-history";
import { useState } from "react";
import { usePrices } from "@/hooks/use-prices";
import { Loader2 } from "lucide-react";
import { PortfolioPeriod } from "@/hooks/use-portfolio-chart-data";
import { usePortfolioTotalValue } from "@/hooks/use-portfolio-total-value";
import { usePortfolioChartData } from "@/hooks/use-portfolio-chart-data";

export default function InversionesPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const [period, setPeriod] = useState<PortfolioPeriod>(90);
    
    // 1. Fetch raw data
    const investmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'investments'), orderBy('purchaseDate', 'desc'));
    }, [firestore, user]);

    const { data: investments, isLoading: loadingInvestments } = useCollection<Investment>(investmentsQuery);

    // 2. Fetch required price data (current and historical)
    const { prices: currentPrices, isLoading: isLoadingPrices } = usePrices(investments);
    const { priceHistory, isLoading: isLoadingHistory } = usePortfolioHistory(investments);

    // 3. Compute derived data using specialized hooks
    const { totalValue } = usePortfolioTotalValue(investments, currentPrices);
    const { chartData } = usePortfolioChartData(investments, priceHistory, period);
    
    const isDataLoading = isUserLoading || loadingInvestments || isLoadingPrices || isLoadingHistory;

    // Show a global loading indicator until all data is ready
    if (isDataLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">Cargando datos de inversiones...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <div className="flex h-full w-full items-center justify-center"><p>Usuario no autenticado.</p></div>
    }

    // Pass all computed and raw data to the manager component
    return <InvestmentsManager 
        investments={investments || []} 
        userId={user.uid}
        chartData={chartData}
        totalValue={totalValue}
        isLoading={isDataLoading}
        currentPrices={currentPrices}
        priceHistory={priceHistory}
        period={period}
        setPeriod={setPeriod}
        />;
}
