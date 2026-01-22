'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { Investment, PriceData, PortfolioDataPoint, PriceHistory } from "@/lib/definitions";
import { InvestmentsManager } from "@/components/inversiones/investments-manager";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';
import { getCryptoPriceHistory } from '@/ai/flows/crypto-price-history';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
import { getStockPrices } from '@/ai/flows/stock-prices';
import { useToast } from '@/hooks/use-toast';
import { subDays, startOfDay, getUnixTime, isAfter, differenceInDays, addDays, min, max } from 'date-fns';

export type PortfolioPeriod = 7 | 30 | 90;

export default function InversionesPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();

    // Raw data from Firestore
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loadingInvestments, setLoadingInvestments] = useState(true);
    
    // Derived state from processing
    const [currentPrices, setCurrentPrices] = useState<PriceData>({});
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map()); // Master 90-day history
    const [totalValue, setTotalValue] = useState(0);
    const [chartData, setChartData] = useState<PortfolioDataPoint[]>([]);
    
    // UI state
    const [period, setPeriod] = useState<PortfolioPeriod>(90);
    const [isDataLoading, setIsDataLoading] = useState(true);

    const investmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'investments'), orderBy('purchaseDate', 'desc'));
    }, [firestore, user]);

    // Effect 1: Listen to raw investment data from Firestore
    useEffect(() => {
        if (!investmentsQuery) {
            setLoadingInvestments(false);
            return;
        }
        setLoadingInvestments(true);
        const unsub = onSnapshot(investmentsQuery, 
            (snap) => {
                const newInvestments = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Investment));
                setInvestments(newInvestments);
                setLoadingInvestments(false);
            },
            (error) => {
                console.error("Investment listener error:", error);
                toast({
                    title: "Error al cargar inversiones",
                    description: "No se pudieron obtener los datos de inversiones en tiempo real.",
                    variant: "destructive",
                });
                setLoadingInvestments(false);
            }
        );
        return () => unsub();
    }, [investmentsQuery, toast]);
    
    // Effect 2: Fetch all remote data (prices, history) when the list of investments changes.
    useEffect(() => {
        const fetchAllInvestmentData = async () => {
            if (isUserLoading || loadingInvestments) return;

            if (investments.length === 0) {
                setIsDataLoading(false);
                setCurrentPrices({});
                setPriceHistory(new Map());
                setTotalValue(0);
                setChartData([]);
                return;
            }
            
            setIsDataLoading(true);

            try {
                // 1. Fetch current prices
                const cryptoAssets = investments.filter(i => i.assetType === 'crypto' && i.coinGeckoId);
                const stockAssets = investments.filter(i => i.assetType === 'stock' && i.symbol);
                
                const cryptoIds = [...new Set(cryptoAssets.map(i => i.coinGeckoId!))];
                const stockSymbols = [...new Set(stockAssets.map(i => i.symbol!))];
                
                let fetchedPrices: PriceData = {};
                
                if (cryptoIds.length > 0) {
                    try {
                        const cryptoPrices = await getCryptoPrices({ ids: cryptoIds });
                        fetchedPrices = { ...fetchedPrices, ...cryptoPrices };
                    } catch (e) {
                         console.warn('Partial failure fetching crypto prices:', e);
                    }
                }

                for (const symbol of stockSymbols) {
                    try {
                        const stockPrice = await getStockPrices({ symbol });
                        fetchedPrices = { ...fetchedPrices, ...stockPrice };
                    } catch (e) {
                        console.warn(`Could not fetch current price for ${symbol}:`, e);
                    }
                    await new Promise(resolve => setTimeout(resolve, 6000)); // Rate limit
                }
                
                setCurrentPrices(fetchedPrices);

                // 2. Fetch FULL 90-DAY history for ALL assets
                const earliestPurchaseDate = investments.reduce((earliest, inv) => 
                    min([earliest, new Date(inv.purchaseDate)]), 
                    new Date()
                );
                const historyFetchStartDate = min([earliestPurchaseDate, startOfDay(subDays(new Date(), 90))]);
                
                const endDate = new Date();
                const startTimestamp = getUnixTime(historyFetchStartDate);
                const endTimestamp = getUnixTime(endDate);

                const historyResults: { id: string; data: Record<string, number> }[] = [];
                const allAssets = [...stockSymbols.map(s => ({type: 'stock', id: s})), ...cryptoIds.map(c => ({type: 'crypto', id: c}))];

                for (const asset of allAssets) {
                     try {
                        let history: { history: Record<string, number> };
                        if (asset.type === 'stock') {
                            history = await getStockPriceHistory({ symbol: asset.id, from: startTimestamp, to: endTimestamp });
                        } else {
                            history = await getCryptoPriceHistory({ id: asset.id, from: startTimestamp, to: endTimestamp });
                        }
                        historyResults.push({ id: asset.id, data: history.history || {} });
                    } catch (e) {
                        console.warn(`Could not fetch history for ${asset.id}:`, e)
                        historyResults.push({ id: asset.id, data: {} });
                    }
                    await new Promise(resolve => setTimeout(resolve, 6000)); // Rate limit delay
                }

                const tempPriceHistory: PriceHistory = new Map();
                historyResults.forEach(res => {
                    const pricesMap = new Map<string, number>();
                    if (res.data) {
                        Object.entries(res.data).forEach(([dateStr, price]) => {
                            pricesMap.set(dateStr, price);
                        });
                    }
                    tempPriceHistory.set(res.id, pricesMap);
                });
                
                const todayStr = new Date().toISOString().split('T')[0];
                for (const [assetId, priceInfo] of Object.entries(fetchedPrices)) {
                    if (priceInfo && typeof priceInfo.price === 'number') {
                        let assetHistoryMap = tempPriceHistory.get(assetId);
                        if (!assetHistoryMap) {
                            assetHistoryMap = new Map<string, number>();
                            tempPriceHistory.set(assetId, assetHistoryMap);
                        }
                        assetHistoryMap.set(todayStr, priceInfo.price);
                    }
                }
                
                const totalDaysInHistory = differenceInDays(endDate, historyFetchStartDate);
                if (totalDaysInHistory >= 0) {
                    for (const [assetId, pricesMap] of tempPriceHistory.entries()) {
                         // Fallback to current price if history is completely empty
                        const lastResortPrice = currentPrices[assetId]?.price;

                        // BACKWARD PASS to fill missing data from the future
                        let nextKnownPrice: number | undefined;
                        for (let i = totalDaysInHistory; i >= 0; i--) {
                            const currentDate = addDays(historyFetchStartDate, i);
                            const dateStr = currentDate.toISOString().split('T')[0];
                            if (pricesMap.has(dateStr)) {
                                nextKnownPrice = pricesMap.get(dateStr);
                            } else if (nextKnownPrice !== undefined) {
                                pricesMap.set(dateStr, nextKnownPrice);
                            }
                        }

                        // FORWARD PASS to fill any remaining gaps from the past
                        let lastKnownPrice: number | undefined;
                        for (let i = 0; i <= totalDaysInHistory; i++) {
                            const currentDate = addDays(historyFetchStartDate, i);
                            const dateStr = currentDate.toISOString().split('T')[0];
                            if (pricesMap.has(dateStr)) {
                                lastKnownPrice = pricesMap.get(dateStr);
                            } else if (lastKnownPrice !== undefined) {
                                pricesMap.set(dateStr, lastKnownPrice);
                            }
                        }
                        // FINAL PASS: if still gaps, use last resort price
                         if (pricesMap.size === 0 && lastResortPrice !== undefined) {
                            for (let i = 0; i <= totalDaysInHistory; i++) {
                                const currentDate = addDays(historyFetchStartDate, i);
                                const dateStr = currentDate.toISOString().split('T')[0];
                                pricesMap.set(dateStr, lastResortPrice);
                            }
                        }
                    }
                }
                setPriceHistory(tempPriceHistory);

            } catch (error) {
                console.error("An error occurred during investment data fetching:", error);
                toast({
                    title: "Error de Carga de Datos",
                    description: "No se pudieron obtener todos los datos de mercado.",
                    variant: "destructive",
                });
            } finally {
                setIsDataLoading(false);
            }
        };

        fetchAllInvestmentData();
    }, [investments, isUserLoading, loadingInvestments, toast]);

    // Effect 3: Generate display data (total value, chart) when period or master data changes.
    useEffect(() => {
        if (isDataLoading || investments.length === 0) {
            return;
        }

        // 1. Calculate Total Value
        let newTotalValue = 0;
        investments.forEach(inv => {
            const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId : inv.symbol;
            if (priceKey && currentPrices[priceKey]) {
                newTotalValue += inv.amount * currentPrices[priceKey].price;
            }
        });
        setTotalValue(newTotalValue);

        // 2. Generate Chart Data
        const chartPeriodStartDate = startOfDay(subDays(new Date(), period - 1));
        const newChartData: PortfolioDataPoint[] = [];
        let lastKnownTotal: number | null = null;
        const chartDays = differenceInDays(new Date(), chartPeriodStartDate);

        for (let i = 0; i <= chartDays; i++) {
            const currentDate = addDays(chartPeriodStartDate, i);
            const dateStr = currentDate.toISOString().split('T')[0];
            let dailyTotal = 0;
            let assetsWithValue = 0;

            investments.forEach(inv => {
                if (isAfter(new Date(inv.purchaseDate), currentDate)) {
                    return;
                }
                
                const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId : inv.symbol;
                if (!priceKey) return;

                const historyForAsset = priceHistory.get(priceKey);
                const priceForDay = historyForAsset?.get(dateStr);
                
                if (priceForDay !== undefined) {
                    dailyTotal += inv.amount * priceForDay;
                    assetsWithValue++;
                }
            });

             if (assetsWithValue > 0) {
                lastKnownTotal = dailyTotal;
                newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
            } else if (lastKnownTotal !== null) {
                newChartData.push({ date: currentDate.getTime(), value: lastKnownTotal });
            } else {
                newChartData.push({ date: currentDate.getTime(), value: null });
            }
        }
        setChartData(newChartData);

    }, [period, priceHistory, currentPrices, investments, isDataLoading]);


    const isLoading = isUserLoading || loadingInvestments || isDataLoading;
    
    if (isLoading && investments.length === 0) {
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

    return <InvestmentsManager 
        investments={investments} 
        userId={user.uid}
        chartData={chartData}
        totalValue={totalValue}
        isLoading={isLoading}
        currentPrices={currentPrices}
        priceHistory={priceHistory}
        period={period}
        setPeriod={setPeriod}
    />;
}
