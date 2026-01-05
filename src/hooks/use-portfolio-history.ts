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

            // Calculate current total value
            const currentTotalValue = investments.reduce((acc, inv) => {
                const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                const currentPrice = prices[priceKey]?.price || inv.purchasePrice;
                return acc + (inv.amount * currentPrice);
            }, 0);
            setTotalValue(currentTotalValue);

            const cryptoIds = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            
            try {
                const endDate = startOfDay(new Date());
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
                
                const priceHistoryMap = new Map<string, Map<string, number>>();

                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.prices) {
                        const { id, prices: apiPrices } = result.value;
                        const dailyPrices = new Map<string, number>();
                        apiPrices.forEach(([timestamp, price]) => {
                            dailyPrices.set(format(startOfDay(new Date(timestamp)), 'yyyy-MM-dd'), price);
                        });
                        priceHistoryMap.set(id, dailyPrices);
                    }
                });

                const newChartData: PortfolioDataPoint[] = [];
                const lastKnownPrices = new Map<string, number>();

                for (let i = 0; i <= 90; i++) {
                    const date = subDays(endDate, 90 - i);
                    const dayTimestamp = date.getTime();
                    const dateStr = format(date, 'yyyy-MM-dd');

                    let dailyTotal = 0;

                    investments.forEach(inv => {
                        if (inv.purchaseDate <= dayTimestamp) {
                            let priceToUse: number;
                            if (inv.assetType === 'crypto') {
                                const assetPriceHistory = priceHistoryMap.get(inv.assetId);
                                if (assetPriceHistory && assetPriceHistory.has(dateStr)) {
                                    priceToUse = assetPriceHistory.get(dateStr)!;
                                    lastKnownPrices.set(inv.id, priceToUse);
                                } else {
                                    priceToUse = lastKnownPrices.get(inv.id) || inv.purchasePrice;
                                }
                            } else {
                                // For stocks, use purchase price until today, then use current market price.
                                const isToday = format(date, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd');
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

    }, [investmentsKey, isLoadingPrices]); 

    return { portfolioHistory, totalValue, isLoading };
}
