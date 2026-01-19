'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { format, subDays, startOfDay, getUnixTime, isAfter, differenceInDays, addDays } from 'date-fns';

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
            if (loadingInvestments || isUserLoading) return;
            
            if (investments.length === 0) {
                setIsProcessing(false);
                setTotalValue(0);
                setChartData([]);
                setCurrentPrices({});
                setPriceHistory(new Map());
                return;
            }
            
            setIsProcessing(true);

            // 1. Fetch current prices
            const cryptoAssets = investments.filter(i => i.assetType === 'crypto');
            const stockAssets = investments.filter(i => i.assetType === 'stock');
            const cryptoIds = [...new Set(cryptoAssets.map(i => i.coinGeckoId || i.id).filter(Boolean))];
            const stockSymbols = [...new Set(stockAssets.map(i => i.symbol).filter(Boolean))];
            
            let fetchedPrices: PriceData = {};
            try {
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
            } catch (error) {
                toast({ title: 'Error de Precios', description: 'No se pudieron obtener algunas cotizaciones.', variant: 'destructive'});
            }
            setCurrentPrices(fetchedPrices);

            // 2. Calculate Total Value
            let newTotalValue = 0;
            investments.forEach(inv => {
                const priceKey = inv.assetType === 'crypto' ? (inv.coinGeckoId || inv.id) : inv.symbol;
                if (priceKey && fetchedPrices[priceKey]) {
                    newTotalValue += inv.amount * fetchedPrices[priceKey].price;
                }
            });
            setTotalValue(newTotalValue);

            // 3. Fetch Price History
            const earliestDate = investments.reduce((earliest, inv) => (inv.purchaseDate && inv.purchaseDate < earliest) ? inv.purchaseDate : earliest, Date.now());
            const startDate = startOfDay(new Date(earliestDate));
            const endDate = startOfDay(new Date());
            const startTimestamp = getUnixTime(startDate);
            const endTimestamp = getUnixTime(endDate);

            const stockHistoryPromises = stockSymbols.map(symbol => 
                getStockPriceHistory({ symbol, from: startTimestamp, to: endTimestamp }).then(d => ({id: symbol, data: d.history})).catch(() => ({id: symbol, data: {}}))
            );
            const cryptoHistoryPromises = cryptoIds.map(id => 
                getCryptoPriceHistory({ id, from: startTimestamp, to: endTimestamp }).then(d => ({id: id, data: d.history})).catch(() => ({id: id, data: {}}))
            );

            const historyResults = await Promise.all([...stockHistoryPromises, ...cryptoHistoryPromises]);
            
            const tempPriceHistory: PriceHistory = new Map();
            historyResults.forEach(res => {
                const pricesMap = new Map<string, number>();
                 if (res.data) {
                    Object.entries(res.data).forEach(([dateStr, price]) => pricesMap.set(dateStr, price));
                }
                tempPriceHistory.set(res.id, pricesMap);
            });
            
            // 4. Fill forward missing prices
            const totalDays = differenceInDays(endDate, startDate);
            if (totalDays >= 0) {
                for (const pricesMap of tempPriceHistory.values()) {
                    let lastKnownPrice: number | undefined;
                    for (let i = 0; i <= totalDays; i++) {
                        const currentDate = addDays(startDate, i);
                        const dateStr = format(currentDate, 'yyyy-MM-dd');
                        if (pricesMap.has(dateStr)) {
                            lastKnownPrice = pricesMap.get(dateStr);
                        } else if (lastKnownPrice !== undefined) {
                            pricesMap.set(dateStr, lastKnownPrice);
                        }
                    }
                }
            }
            setPriceHistory(tempPriceHistory);
            
            // 5. Generate Chart Data
            const chartStartDate = startOfDay(subDays(endDate, period - 1));
            const chartDays = differenceInDays(endDate, chartStartDate) + 1;
            const newChartData: PortfolioDataPoint[] = [];

            for (let i = 0; i < chartDays; i++) {
                const currentDate = addDays(chartStartDate, i);
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                let dailyTotal = 0;

                investments.forEach(inv => {
                    if (!isAfter(new Date(inv.purchaseDate), currentDate)) {
                        const priceKey = inv.assetType === 'crypto' ? (inv.coinGeckoId || inv.id) : inv.symbol;
                        const historyForAsset = tempPriceHistory.get(priceKey);
                        const priceForDay = historyForAsset?.get(dateStr);
                        if (priceForDay !== undefined) {
                            dailyTotal += inv.amount * priceForDay;
                        }
                    }
                });
                newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
            }
            setChartData(newChartData);

            setIsProcessing(false);
        };

        processInvestmentData();

    }, [investments, isUserLoading, loadingInvestments, period, toast]); // Re-run when investments or period change

    const isLoading = isUserLoading || loadingInvestments || isProcessing;
    
    if (isLoading) {
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
