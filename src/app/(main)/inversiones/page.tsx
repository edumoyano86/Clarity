'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { subDays, startOfDay, getUnixTime, isAfter, differenceInDays, addDays, format as formatDate } from 'date-fns';

export type PortfolioPeriod = 7 | 30 | 90;

export default function InversionesPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();

    // Raw data from Firestore
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loadingInvestments, setLoadingInvestments] = useState(true);
    
    // Derived state
    const [currentPrices, setCurrentPrices] = useState<PriceData>({});
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());
    const [totalValue, setTotalValue] = useState(0);
    const [chartData, setChartData] = useState<PortfolioDataPoint[]>([]);
    
    // UI state
    const [period, setPeriod] = useState<PortfolioPeriod>(90);
    const [isProcessing, setIsProcessing] = useState(true);
    const isProcessingRef = useRef(false);

    const investmentsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'investments'), orderBy('purchaseDate', 'desc'));
    }, [firestore, user]);

    // Firestore listener for investments
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
    
    // The main effect to process all data when investments change
    useEffect(() => {
        const processInvestmentData = async () => {
            if (loadingInvestments || isUserLoading || isProcessingRef.current) return;
            
            if (investments.length === 0) {
                setIsProcessing(false);
                setTotalValue(0);
                setChartData([]);
                setCurrentPrices({});
                setPriceHistory(new Map());
                return;
            }
            
            isProcessingRef.current = true;
            setIsProcessing(true);

            try {
                // 1. Fetch current prices
                const cryptoAssets = investments.filter(i => i.assetType === 'crypto' && i.coinGeckoId);
                const stockAssets = investments.filter(i => i.assetType === 'stock' && i.symbol);
                
                const cryptoIds = [...new Set(cryptoAssets.map(i => i.coinGeckoId!))];
                const stockSymbols = [...new Set(stockAssets.map(i => i.symbol!))];
                
                let fetchedPrices: PriceData = {};
                const pricePromises = [];
                if (cryptoIds.length > 0) pricePromises.push(getCryptoPrices({ ids: cryptoIds }));
                if (stockSymbols.length > 0) pricePromises.push(getStockPrices({ symbols: stockSymbols }));
                
                const results = await Promise.allSettled(pricePromises);

                results.forEach(res => {
                    if (res.status === 'fulfilled' && res.value) {
                        fetchedPrices = { ...fetchedPrices, ...res.value };
                    } else if (res.status === 'rejected') {
                        console.warn('Partial failure fetching prices:', res.reason);
                    }
                });
                setCurrentPrices(fetchedPrices);

                // 2. Calculate Total Value
                let newTotalValue = 0;
                investments.forEach(inv => {
                    const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId : inv.symbol;
                    if (priceKey && fetchedPrices[priceKey]) {
                        newTotalValue += inv.amount * fetchedPrices[priceKey].price;
                    }
                });
                setTotalValue(newTotalValue);

                // 3. Fetch Price History
                const chartPeriodStartDate = startOfDay(subDays(new Date(), period -1));
                const earliestPurchaseDate = investments.reduce((earliest, inv) => 
                    (inv.purchaseDate && inv.purchaseDate < earliest) ? inv.purchaseDate : earliest, 
                    Date.now()
                );

                const historyFetchStartDate = isAfter(new Date(earliestPurchaseDate), chartPeriodStartDate) 
                    ? chartPeriodStartDate 
                    : startOfDay(new Date(earliestPurchaseDate));
                
                const endDate = new Date();
                const startTimestamp = getUnixTime(historyFetchStartDate);
                const endTimestamp = getUnixTime(endDate);

                const historyResults: { id: string; data: Record<string, number> | {} }[] = [];
                
                const fetchHistorySerially = async () => {
                    const allAssets = [...stockSymbols.map(s => ({type: 'stock', id: s})), ...cryptoIds.map(c => ({type: 'crypto', id: c}))];
                    for (const asset of allAssets) {
                         try {
                            if (asset.type === 'stock') {
                                const history = await getStockPriceHistory({ symbol: asset.id, from: startTimestamp, to: endTimestamp });
                                historyResults.push({ id: asset.id, data: history.history });
                            } else {
                                const history = await getCryptoPriceHistory({ id: asset.id, from: startTimestamp, to: endTimestamp });
                                historyResults.push({ id: asset.id, data: history.history });
                            }
                        } catch (e) {
                            console.warn(`Could not fetch history for ${asset.id}:`, e)
                            historyResults.push({ id: asset.id, data: {} });
                        }
                        await new Promise(resolve => setTimeout(resolve, 2100)); // Rate limit delay
                    }
                };

                await fetchHistorySerially();

                const tempPriceHistory: PriceHistory = new Map();
                historyResults.forEach(res => {
                    const pricesMap = new Map<string, number>();
                    if (res.data) {
                        Object.entries(res.data).forEach(([dateStr, price]) => {
                            const date = new Date(dateStr);
                            const utcDateStr = date.toISOString().split('T')[0];
                            pricesMap.set(utcDateStr, price)
                        });
                    }
                    tempPriceHistory.set(res.id, pricesMap);
                });
                
                // 4. Inject current day's price into history to ensure chart is up-to-date
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

                // 5. Fill forward missing prices in the complete history
                const totalDaysInHistory = differenceInDays(endDate, historyFetchStartDate);
                if (totalDaysInHistory >= 0) {
                    for (const pricesMap of tempPriceHistory.values()) {
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
                    }
                }
                setPriceHistory(tempPriceHistory);
                
                // 6. Generate Chart Data
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

                        const historyForAsset = tempPriceHistory.get(priceKey);
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
                        // If no assets had a value today, carry forward the last known total
                        newChartData.push({ date: currentDate.getTime(), value: lastKnownTotal });
                    } else {
                        newChartData.push({ date: currentDate.getTime(), value: null });
                    }
                }
                setChartData(newChartData);

            } catch (error) {
                console.error("An error occurred during investment processing:", error);
                toast({
                    title: "Error de Procesamiento",
                    description: "No se pudieron procesar los datos de inversiones.",
                    variant: "destructive",
                });
                setTotalValue(0);
                setChartData([]);
            } finally {
                isProcessingRef.current = false;
                setIsProcessing(false);
            }
        };

        processInvestmentData();

    }, [investments, isUserLoading, loadingInvestments, period, toast]);

    const isLoading = isUserLoading || loadingInvestments || isProcessing;
    
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
