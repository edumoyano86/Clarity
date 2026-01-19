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

            // Step 1: Find the earliest purchase date across all investments.
            const earliestPurchaseDate = investments.reduce((earliest, inv) => {
                if (typeof inv.purchaseDate === 'number' && !isNaN(inv.purchaseDate) && inv.purchaseDate > 0) {
                    return Math.min(earliest, inv.purchaseDate);
                }
                return earliest;
            }, Date.now());

            const endDate = startOfDay(new Date());
            // Fetch history from the absolute earliest purchase date.
            const historyStartDate = startOfDay(new Date(earliestPurchaseDate));

            const startTimestamp = getUnixTime(historyStartDate);
            const endTimestamp = getUnixTime(endDate);
            
            // Step 2: Fetch full price history for all assets from the earliest date.
            const cryptoAssets = investments.filter(i => i.assetType === 'crypto' && i.coinGeckoId);
            const stockAssets = investments.filter(i => i.assetType === 'stock');
            const cryptoIdsToFetch = [...new Set(cryptoAssets.map(a => a.coinGeckoId!))];
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
                        return { id: id, data: {} };
                    })
            );
            
            const results = await Promise.all([...stockPromises, ...cryptoPromises]);
            const allPriceHistory: PriceHistory = new Map();
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

            // Step 3: Correctly forward-fill the price data for the entire historical range.
            const totalDays = differenceInDays(endDate, historyStartDate);
            if (totalDays >= 0) {
                for (const pricesMap of allPriceHistory.values()) {
                    let lastKnownPrice: number | undefined;
                    for (let i = 0; i <= totalDays; i++) {
                        const currentDate = addDays(historyStartDate, i);
                        const dateStr = format(currentDate, 'yyyy-MM-dd');
                        if (pricesMap.has(dateStr)) {
                            lastKnownPrice = pricesMap.get(dateStr);
                        } else if (lastKnownPrice !== undefined) {
                            pricesMap.set(dateStr, lastKnownPrice);
                        }
                    }
                }
            }
            // Now `allPriceHistory` is complete and correct.
            setPriceHistory(allPriceHistory);
            
            // Step 4: Calculate the chart data for the selected display period (e.g., last 90 days).
            const chartStartDate = startOfDay(subDays(endDate, chartPeriodInDays -1));
            const chartDays = differenceInDays(endDate, chartStartDate) + 1;
            const newChartData: PortfolioDataPoint[] = [];

            for (let i = 0; i < chartDays; i++) {
                const currentDate = addDays(chartStartDate, i);
                
                let dailyTotal = 0;
                investments.forEach(inv => {
                    const purchaseDate = inv.purchaseDate;
                     const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId : inv.symbol;

                    if (!priceKey || typeof purchaseDate !== 'number' || isNaN(purchaseDate) || purchaseDate <=0) return;

                    if (!isAfter(new Date(purchaseDate), currentDate)) {
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
