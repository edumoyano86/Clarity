'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory, PriceData } from '@/lib/definitions';
import { format, subDays, startOfDay, getUnixTime, fromUnixTime, isAfter } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';
import { getCryptoPriceHistory } from '@/ai/flows/crypto-price-history';

export type PortfolioPeriod = 7 | 30 | 90;

export function usePortfolioHistory(
    investments: Investment[] | null,
    periodInDays: PortfolioPeriod = 90,
    currentPrices: PriceData
) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());
    const [totalValue, setTotalValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const investmentsKey = useMemo(() => investments?.map(inv => `${inv.id}-${inv.symbol}`).join(','), [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || investments.length === 0) {
                setPortfolioHistory([]);
                setPriceHistory(new Map());
                setTotalValue(0);
                setIsLoading(false);
                return;
            }

            // Start loading only when we have investments to process
            setIsLoading(true);

            // Calculate current total value using the prices passed as props
            const currentTotalValue = investments.reduce((acc, inv) => {
                const priceKey = inv.symbol;
                const currentPrice = currentPrices[priceKey]?.price || 0;
                return acc + (inv.amount * currentPrice);
            }, 0);
            setTotalValue(currentTotalValue);
            
            const cryptoSymbols = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.symbol))];
            const stockSymbols = [...new Set(investments.filter(i => i.assetType === 'stock').map(inv => inv.symbol))];

            const endDate = startOfDay(new Date());
            const startDate = subDays(endDate, periodInDays);
            const startTimestamp = getUnixTime(startDate);
            const endTimestamp = getUnixTime(endDate);

            const allPriceHistory: PriceHistory = new Map();
            
            const stockPromises = stockSymbols.map(symbol => 
                getStockPriceHistory({ symbol, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ symbol, data: data.history }))
                    .catch(err => {
                        console.warn(`Could not fetch stock history for ${symbol}:`, err);
                        return { symbol, data: {} };
                    })
            );

            const cryptoPromises = cryptoSymbols.map(symbol => 
                getCryptoPriceHistory({ symbol, from: startTimestamp, to: endTimestamp })
                     .then(data => ({ symbol, data: data.history }))
                     .catch(err => {
                        console.warn(`Could not fetch crypto history for ${symbol}:`, err);
                        return { symbol, data: {} };
                    })
            );

            const results = await Promise.all([...stockPromises, ...cryptoPromises]);

            // Process all results
            results.forEach(result => {
                if (result.data) {
                    const pricesMap = new Map<string, number>();
                    Object.entries(result.data).forEach(([dateStr, price]) => {
                        pricesMap.set(dateStr, price);
                    });
                    allPriceHistory.set(result.symbol, pricesMap);
                }
            });
            
            // Fill gaps in price history
            for (const [symbol, pricesMap] of allPriceHistory.entries()) {
                let lastKnownPrice: number | undefined = undefined;
                 // First pass: from past to present to fill forward
                for (let i = periodInDays; i >= 0; i--) {
                    const currentDate = startOfDay(subDays(endDate, i));
                    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                    if (pricesMap.has(currentDateStr) && pricesMap.get(currentDateStr)! > 0) {
                        lastKnownPrice = pricesMap.get(currentDateStr);
                    } else if (lastKnownPrice !== undefined) {
                        pricesMap.set(currentDateStr, lastKnownPrice);
                    }
                }
                 // Second pass: from present to past to fill backward for initial days
                lastKnownPrice = currentPrices[symbol]?.price || Array.from(pricesMap.values()).find(p => p > 0);
                 for (let i = 0; i <= periodInDays; i++) {
                    const currentDate = startOfDay(subDays(endDate, i));
                    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                     if (!pricesMap.has(currentDateStr) || pricesMap.get(currentDateStr)! <= 0) {
                        if (lastKnownPrice !== undefined) {
                            pricesMap.set(currentDateStr, lastKnownPrice);
                        }
                    } else {
                         lastKnownPrice = pricesMap.get(currentDateStr);
                     }
                }
            }
            setPriceHistory(allPriceHistory);

            // Calculate portfolio value for each day in the period
            const newChartData: PortfolioDataPoint[] = [];
            for (let i = periodInDays; i >= 0; i--) {
                const currentDate = startOfDay(subDays(endDate, i));
                const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                let dailyTotal = 0;

                investments.forEach(inv => {
                    const purchaseDate = startOfDay(new Date(inv.purchaseDate));
                    if (!isAfter(purchaseDate, currentDate)) {
                        const priceKey = inv.symbol;
                        const historyForAsset = allPriceHistory.get(priceKey);
                        const priceForDay = historyForAsset?.get(currentDateStr) || 0;
                        
                        dailyTotal += inv.amount * priceForDay;
                    }
                });
                newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
            }
            
            if (newChartData.length > 0 && currentTotalValue > 0) {
                 newChartData[newChartData.length - 1].value = currentTotalValue;
            }

            setPortfolioHistory(newChartData);
            setIsLoading(false);
        };

        // Only run if there are investments and currentPrices are available.
        if (investments && Object.keys(currentPrices).length > 0) {
             fetchHistory().catch(error => {
                console.error("Error fetching portfolio history:", error);
                setIsLoading(false);
            });
        } else if (!investments || investments.length === 0) {
            // No investments, so we are not loading.
             setIsLoading(false);
             setPortfolioHistory([]);
             setTotalValue(0);
             setPriceHistory(new Map());
        }
        // if investments exist but prices are not there, usePrices is loading, so we wait.
        // The isLoading state from this hook will be true by default.

    }, [investmentsKey, periodInDays, currentPrices]);

    return { portfolioHistory, totalValue, isLoading, priceHistory };
}
