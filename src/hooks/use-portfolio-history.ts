'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint } from '@/lib/definitions';
import { usePrices } from './use-prices';
import { format, subDays, startOfDay } from 'date-fns';

export function usePortfolioHistory(investments: Investment[]) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [totalValue, setTotalValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const { prices, isLoading: isLoadingPrices } = usePrices(investments);

    const investmentsKey = useMemo(() => investments.map(i => i.id + i.amount).join(','), [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (isLoadingPrices || !investments) {
                // Wait until prices and investments are loaded
                return;
            }

            if (investments.length === 0) {
                setPortfolioHistory([]);
                setTotalValue(0);
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);

            // Calculate current total value
            const currentTotalValue = investments.reduce((acc, inv) => {
                const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                const currentPrice = prices[priceKey]?.price || inv.purchasePrice;
                return acc + (inv.amount * currentPrice);
            }, 0);
            setTotalValue(currentTotalValue);

            const cryptoIds = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            
            if (cryptoIds.length === 0) {
                // If only stocks, we can't easily get history, so we'll show a simplified view
                 const newChartData: PortfolioDataPoint[] = [];
                 const endDate = new Date();
                 for (let i = 0; i <= 90; i++) {
                     const date = subDays(endDate, 90 - i);
                     const dayTimestamp = startOfDay(date).getTime();
                     let dailyTotal = 0;
                     investments.forEach(inv => {
                         if (inv.purchaseDate <= dayTimestamp) {
                            // For stocks, use current price as we don't fetch their history
                            const price = prices[inv.symbol]?.price || inv.purchasePrice;
                            dailyTotal += inv.amount * price;
                         }
                     });
                     newChartData.push({ date: dayTimestamp, value: dailyTotal });
                 }
                setPortfolioHistory(newChartData);
                setIsLoading(false);
                return;
            }

            try {
                const endDate = new Date();
                const startDate = subDays(endDate, 90);

                const promises = cryptoIds.map(id =>
                    fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${startDate.getTime() / 1000}&to=${endDate.getTime() / 1000}`)
                        .then(res => {
                            if (!res.ok) {
                                console.warn(`Failed to fetch history for ${id}: ${res.statusText}`);
                                return { id, prices: null };
                            }
                            return res.json().then(data => ({ id, prices: data.prices }));
                        })
                        .catch(err => {
                            console.error(`Error fetching history for ${id}:`, err);
                            return { id, prices: null };
                        })
                );

                const results = await Promise.allSettled(promises);
                const successfulResults = results
                    .filter(result => result.status === 'fulfilled' && result.value.prices)
                    .map(result => (result as PromiseFulfilledResult<any>).value);

                const priceHistoryMap = new Map<string, Map<string, number>>();
                successfulResults.forEach(result => {
                    const assetMap = new Map<string, number>();
                    result.prices.forEach(([timestamp, price]: [number, number]) => {
                        const dateStr = format(new Date(timestamp), 'yyyy-MM-dd');
                        assetMap.set(dateStr, price);
                    });
                    priceHistoryMap.set(result.id, assetMap);
                });

                const lastKnownPrices: {[key: string]: number} = {};

                const newChartData: PortfolioDataPoint[] = [];
                for (let i = 0; i <= 90; i++) {
                    const date = subDays(endDate, 90 - i);
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayTimestamp = startOfDay(date).getTime();

                    let dailyTotal = 0;
                    investments.forEach(inv => {
                        // Only include investments that existed on this day
                        if (inv.purchaseDate <= dayTimestamp) {
                            let priceToUse = 0;
                            if (inv.assetType === 'crypto') {
                                const assetPriceHistory = priceHistoryMap.get(inv.assetId);
                                if (assetPriceHistory?.has(dateStr)) {
                                    priceToUse = assetPriceHistory.get(dateStr)!;
                                    lastKnownPrices[inv.assetId] = priceToUse;
                                } else {
                                    // If no price for today, use the last known price for this asset
                                    priceToUse = lastKnownPrices[inv.assetId] || inv.purchasePrice;
                                }
                            } else { // stock
                                // For stocks, use current price as we don't fetch their history
                                priceToUse = prices[inv.symbol]?.price || inv.purchasePrice;
                            }
                            dailyTotal += inv.amount * priceToUse;
                        }
                    });
                    newChartData.push({ date: dayTimestamp, value: dailyTotal });
                }

                setPortfolioHistory(newChartData);

            } catch (error) {
                console.error("An error occurred while building portfolio history:", error);
                setPortfolioHistory([]); // Clear history on major error
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();

    }, [investmentsKey, isLoadingPrices]); // Depend on the key and price loading state

    return { portfolioHistory, totalValue, isLoading };
}
