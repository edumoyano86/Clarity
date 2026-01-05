'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint } from '@/lib/definitions';
import { usePrices } from './use-prices';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';

export type PortfolioPeriod = 7 | 30 | 90;

export function usePortfolioHistory(investments: Investment[], periodInDays: PortfolioPeriod = 90) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [totalValue, setTotalValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const { prices, isLoading: isLoadingPrices } = usePrices(investments || []);

    const investmentsKey = useMemo(() => investments?.map(i => i.id + i.amount).join(',') || '', [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (isLoadingPrices || !investments) {
                if (!investments || investments.length === 0) {
                  setPortfolioHistory([]);
                  setTotalValue(0);
                  setIsLoading(false);
                }
                return;
            }

            if (investments.length === 0) {
                setPortfolioHistory([]);
                setTotalValue(0);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            // Calculate current total value first
            const currentTotalValue = investments.reduce((acc, inv) => {
                const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                const currentPrice = prices[priceKey]?.price || inv.purchasePrice;
                return acc + (inv.amount * currentPrice);
            }, 0);
            setTotalValue(currentTotalValue);

            const cryptoIds = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            
            try {
                const endDate = startOfDay(new Date());
                const startDate = subDays(endDate, periodInDays);

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
                
                const rawPriceHistoryMap = new Map<string, Map<string, number>>();

                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.prices) {
                        const { id, prices: apiPrices } = result.value;
                        const dailyPrices = new Map<string, number>();
                        apiPrices.forEach(([timestamp, price]) => {
                            dailyPrices.set(format(startOfDay(new Date(timestamp)), 'yyyy-MM-dd'), price);
                        });
                        rawPriceHistoryMap.set(id, dailyPrices);
                    }
                });

                const completePriceHistoryMap = new Map<string, Map<string, number>>();

                // Create complete history for each crypto, filling gaps
                for (const cryptoId of cryptoIds) {
                    const cryptoHistory = new Map<string, number>();
                    const rawHistory = rawPriceHistoryMap.get(cryptoId);
                    let lastKnownPrice: number | undefined = undefined;

                    // Find the first available price to backfill if needed
                    for (let i = 0; i <= periodInDays; i++) {
                        const date = subDays(endDate, periodInDays - i);
                        const dateStr = format(date, 'yyyy-MM-dd');
                        if(rawHistory?.has(dateStr)) {
                            lastKnownPrice = rawHistory.get(dateStr)!;
                            break;
                        }
                    }

                    for (let i = 0; i <= periodInDays; i++) {
                        const date = subDays(endDate, periodInDays - i);
                        const dateStr = format(date, 'yyyy-MM-dd');
                        
                        if (rawHistory && rawHistory.has(dateStr)) {
                            lastKnownPrice = rawHistory.get(dateStr)!;
                        }
                        
                        if (lastKnownPrice !== undefined) {
                            cryptoHistory.set(dateStr, lastKnownPrice);
                        }
                    }
                    completePriceHistoryMap.set(cryptoId, cryptoHistory);
                }


                const newChartData: PortfolioDataPoint[] = [];

                for (let i = 0; i <= periodInDays; i++) {
                    const date = subDays(endDate, periodInDays - i);
                    const dayTimestamp = date.getTime();
                    const dateStr = format(date, 'yyyy-MM-dd');

                    let dailyTotal = 0;

                    investments.forEach(inv => {
                        if (inv.purchaseDate <= dayTimestamp) {
                            let priceToUse: number;
                            if (inv.assetType === 'crypto') {
                                const assetPriceHistory = completePriceHistoryMap.get(inv.assetId);
                                const isToday = isSameDay(date, endDate);

                                if (isToday) {
                                    priceToUse = prices[inv.assetId]?.price || inv.purchasePrice;
                                } else {
                                    priceToUse = assetPriceHistory?.get(dateStr) || inv.purchasePrice;
                                }
                            } else { // stock
                                 const isToday = isSameDay(date, endDate);
                                 priceToUse = isToday ? (prices[inv.symbol]?.price || inv.purchasePrice) : inv.purchasePrice;
                            }
                            dailyTotal += inv.amount * priceToUse;
                        }
                    });
                    newChartData.push({ date: dayTimestamp, value: dailyTotal });
                }

                setPortfolioHistory(newChartData);

            } catch (error) {
                console.error("An error occurred while building portfolio history:", error);
                setPortfolioHistory([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();

    }, [investmentsKey, isLoadingPrices, periodInDays]); 

    return { portfolioHistory, totalValue, isLoading };
}
