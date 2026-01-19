'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { format, subDays, startOfDay, getUnixTime, isAfter, differenceInDays, addDays } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';
import { getCryptoPriceHistory } from '@/ai/flows/crypto-price-history';

export type PortfolioPeriod = 7 | 30 | 90;

export function usePortfolioHistory(
    investments: Investment[] | null,
    chartPeriodInDays: PortfolioPeriod = 90
) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());
    const [isLoading, setIsLoading] = useState(true);

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

            const endDate = startOfDay(new Date());
            // Simplified: Always fetch the last 90 days of history.
            // This is enough for all chart periods and for purchase price lookup of recent investments.
            const historyStartDate = startOfDay(subDays(endDate, 90)); 
            
            const startTimestamp = getUnixTime(historyStartDate);
            const endTimestamp = getUnixTime(endDate);

            const cryptoAssets = investments.filter(i => i.assetType === 'crypto');
            const stockAssets = investments.filter(i => i.assetType === 'stock');

            const allPriceHistory: PriceHistory = new Map();

            const cryptoIdsToFetch = [...new Set(cryptoAssets.map(a => a.coinGeckoId || a.id).filter(Boolean) as string[])];
            const stockSymbolsToFetch = [...new Set(stockAssets.map(a => a.symbol))];

            const stockPromises = stockSymbolsToFetch.map(symbol =>
                getStockPriceHistory({ symbol: symbol, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ id: symbol, data: data.history }))
                    .catch(err => {
                        console.warn(`Could not fetch stock history for ${symbol}:`, err);
                        return { id: symbol, data: {} };
                    })
            );

            const cryptoPromises = cryptoIdsToFetch.map(id =>
                getCryptoPriceHistory({ id, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ id, data: data.history }))
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
            const totalDays = differenceInDays(endDate, historyStartDate);
            if (totalDays >= 0) {
                for (const pricesMap of allPriceHistory.values()) {
                    let lastKnownPrice: number | undefined;
                    for (let i = 0; i <= totalDays; i++) {
                        const date = addDays(historyStartDate, i);
                        const dateStr = format(date, 'yyyy-MM-dd');

                        if (pricesMap.has(dateStr)) {
                            lastKnownPrice = pricesMap.get(dateStr);
                        } else if (lastKnownPrice !== undefined) {
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
                    const purchaseDate = inv.purchaseDate;
                    if (typeof purchaseDate !== 'number' || isNaN(purchaseDate) || purchaseDate <=0) return;

                    if (!isAfter(new Date(purchaseDate), currentDate)) {
                        const priceKey = inv.assetType === 'crypto' ? (inv.coinGeckoId || inv.id) : inv.symbol;
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

    }, [investmentsKey, chartPeriodInDays]);

    const totalValue = useMemo(() => {
        if (isLoading || portfolioHistory.length === 0) return 0;
        const lastDataPoint = portfolioHistory[portfolioHistory.length - 1];
        return lastDataPoint?.value || 0;
    }, [isLoading, portfolioHistory]);

    return { portfolioHistory, isLoading, priceHistory, totalValue };
}
