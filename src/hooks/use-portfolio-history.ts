'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint } from '@/lib/definitions';
import { usePrices } from './use-prices';
import { format, subDays, startOfDay } from 'date-fns';

export function usePortfolioHistory(investments: Investment[]) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [totalValue, setTotalValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const { prices, isLoading: isLoadingPrices } = usePrices(investments || []);

    const investmentsKey = useMemo(() => investments?.map(i => i.id + i.amount).join(',') || '', [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (isLoadingPrices || !investments) {
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
                            return res.json().then(data => ({ id, prices: data.prices as [number, number][] }));
                        })
                );

                const results = await Promise.allSettled(promises);
                
                const successfulResults = results
                    .filter(result => result.status === 'fulfilled' && result.value.prices)
                    .map(result => (result as PromiseFulfilledResult<{id: string, prices: [number, number][]}>).value);
                
                const priceHistoryMap = new Map<string, Map<string, number>>();

                // 1. Create a complete, gap-filled price history for each fetched crypto asset
                successfulResults.forEach(result => {
                    const dailyPrices = new Map<string, number>();
                    result.prices.forEach(([timestamp, price]) => {
                        dailyPrices.set(format(new Date(timestamp), 'yyyy-MM-dd'), price);
                    });

                    const filledPrices = new Map<string, number>();
                    let lastKnownPrice: number | null = null;
                    for (let i = 0; i <= 90; i++) {
                        const date = subDays(endDate, 90-i);
                        const dateStr = format(date, 'yyyy-MM-dd');
                        if (dailyPrices.has(dateStr)) {
                            lastKnownPrice = dailyPrices.get(dateStr)!;
                            filledPrices.set(dateStr, lastKnownPrice);
                        } else if (lastKnownPrice !== null) {
                            filledPrices.set(dateStr, lastKnownPrice); // Fill gap with last known price
                        }
                    }
                    priceHistoryMap.set(result.id, filledPrices);
                });


                // 2. Calculate portfolio value for each day
                const newChartData: PortfolioDataPoint[] = [];
                for (let i = 0; i <= 90; i++) {
                    const date = subDays(endDate, 90 - i);
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayTimestamp = startOfDay(date).getTime();

                    let dailyTotal = 0;
                    investments.forEach(inv => {
                        // Only include investments that existed on this day
                        if (inv.purchaseDate <= dayTimestamp) {
                            let priceToUse: number;
                            if (inv.assetType === 'crypto') {
                                const assetPriceHistory = priceHistoryMap.get(inv.assetId);
                                priceToUse = assetPriceHistory?.get(dateStr) || inv.purchasePrice; // Fallback to purchase price if still no data
                            } else { // For stocks, use current price as a stable fallback for history
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
                setPortfolioHistory([]); // Reset on error
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();

    }, [investmentsKey, isLoadingPrices]); 

    return { portfolioHistory, totalValue, isLoading };
}
