'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { format, subDays, startOfDay, getUnixTime, isAfter, differenceInDays, addDays } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';
import { getCryptoPriceHistory } from '@/ai/flows/crypto-price-history';
import { useToast } from './use-toast';

export type PortfolioPeriod = 7 | 30 | 90;

export function usePortfolioHistory(
    investments: Investment[] | null,
    chartPeriodInDays: PortfolioPeriod = 90
) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const investmentsKey = useMemo(() => {
        if (!investments) return '';
        return investments.map(inv => `${inv.id}-${inv.amount}-${inv.purchaseDate}`).sort().join(',');
    }, [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || investments.length === 0) {
                setPortfolioHistory([]);
                setPriceHistory(new Map());
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            const earliestPurchaseDate = investments.reduce((earliest, inv) => {
                const purchaseDate = inv.purchaseDate;
                if (typeof purchaseDate === 'number' && !isNaN(purchaseDate) && purchaseDate > 0) {
                     if (purchaseDate < earliest) {
                        return purchaseDate;
                    }
                }
                return earliest;
            }, Date.now());

            const endDate = startOfDay(new Date());
            const safeEarliestDate = earliestPurchaseDate > endDate.getTime() ? endDate : new Date(earliestPurchaseDate);
            const startDate = startOfDay(safeEarliestDate);
            
            const startTimestamp = getUnixTime(startDate);
            const endTimestamp = getUnixTime(endDate);

            const cryptoAssets = investments.filter(i => i.assetType === 'crypto' && i.coinGeckoId);
            const stockAssets = investments.filter(i => i.assetType === 'stock');

            const allPriceHistory: PriceHistory = new Map();

            const cryptoIdsToFetch = [...new Set(cryptoAssets.map(a => a.coinGeckoId).filter(Boolean) as string[])];
            const stockSymbolsToFetch = [...new Set(stockAssets.map(a => a.symbol))];

            const stockPromises = stockSymbolsToFetch.map(symbol =>
                getStockPriceHistory({ symbol: symbol, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ id: symbol, data: data.history }))
                    .catch(err => {
                        console.warn(`Could not fetch stock history for ${symbol}:`, err);
                        toast({ title: 'Error de Historial', description: `No se pudo obtener el historial para ${symbol}.`, variant: 'destructive'});
                        return { id: symbol, data: {} };
                    })
            );

            const cryptoPromises = cryptoIdsToFetch.map(id =>
                getCryptoPriceHistory({ id: id, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ id: id, data: data.history }))
                    .catch(err => {
                        console.warn(`Could not fetch crypto history for ${id}:`, err);
                        return { id, data: {} };
                    })
            );
            
            const results = await Promise.all([...stockPromises, ...cryptoPromises]);
            
            results.forEach(result => {
                if (result) {
                    const pricesMap = new Map<string, number>();
                    if (result.data) {
                        Object.entries(result.data).forEach(([dateStr, price]) => {
                            pricesMap.set(dateStr, price);
                        });
                    }
                    allPriceHistory.set(result.id, pricesMap);
                }
            });

            // Correct Gap-Filling Logic: Carry prices forward in time.
            const totalDays = differenceInDays(endDate, startDate);
            if (totalDays >= 0) {
                for (const pricesMap of allPriceHistory.values()) {
                    let lastKnownPrice: number | undefined;
                    for (let i = 0; i <= totalDays; i++) {
                        const date = addDays(startDate, i);
                        const dateStr = format(date, 'yyyy-MM-dd');

                        if (pricesMap.has(dateStr)) {
                            // If a price exists for the current day, update our last known price.
                            lastKnownPrice = pricesMap.get(dateStr);
                        } else if (lastKnownPrice !== undefined) {
                            // If no price exists and we have a previously known price, fill the gap.
                            pricesMap.set(dateStr, lastKnownPrice);
                        }
                    }
                }
            }
            
            setPriceHistory(allPriceHistory);
            
            const newChartData: PortfolioDataPoint[] = [];

            for (let i = chartPeriodInDays - 1; i >= 0; i--) {
                const currentDate = startOfDay(subDays(endDate, i));
                
                let dailyTotal = 0;
                investments.forEach(inv => {
                    // Skip legacy assets that haven't been updated
                    if (inv.assetType === 'crypto' && !inv.coinGeckoId) {
                        return;
                    }
                    
                    const purchaseDate = inv.purchaseDate;
                    if (typeof purchaseDate !== 'number' || isNaN(purchaseDate) || purchaseDate <=0) return;

                    const isPurchased = !isAfter(new Date(purchaseDate), currentDate);
                    if (isPurchased) {
                        const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId! : inv.symbol;
                        if (!priceKey) return;

                        const historyForAsset = allPriceHistory.get(priceKey);
                        const priceForDay = historyForAsset?.get(format(currentDate, 'yyyy-MM-dd'));
                        
                        if (priceForDay) {
                            dailyTotal += inv.amount * priceForDay;
                        }
                    }
                });
                newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
            }
            
            setPortfolioHistory(newChartData);
            setIsLoading(false);
        };

        fetchHistory().catch(error => {
            console.error("Error fetching portfolio history:", error);
            setIsLoading(false);
        });

    }, [investmentsKey, chartPeriodInDays, toast]);

    const totalValue = useMemo(() => {
         if (!investments || isLoading || portfolioHistory.length === 0) return 0;
        const lastDataPoint = portfolioHistory[portfolioHistory.length - 1];
        return lastDataPoint?.value || 0;
    }, [investments, isLoading, portfolioHistory]);

    return { portfolioHistory, isLoading, priceHistory, totalValue };
}
