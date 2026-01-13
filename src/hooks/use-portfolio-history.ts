'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { format, subDays, startOfDay, getUnixTime, isAfter, differenceInDays } from 'date-fns';
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

            // Determine the full date range needed.
            // We only need to go back as far as the longest chart period (90 days)
            // plus any purchase dates within that period.
            const endDate = startOfDay(new Date());
            const startDate = startOfDay(subDays(endDate, 90));
            const startTimestamp = getUnixTime(startDate);
            const endTimestamp = getUnixTime(endDate);

            const cryptoAssets = investments.filter(i => i.assetType === 'crypto');
            const stockAssets = investments.filter(i => i.assetType === 'stock');

            const allPriceHistory: PriceHistory = new Map();

            const cryptoIdsToFetch = [...new Set(cryptoAssets.map(a => a.coinGeckoId || a.id).filter(Boolean))];
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
                const pricesMap = new Map<string, number>();
                if (result.data) {
                    Object.entries(result.data).forEach(([dateStr, price]) => {
                        pricesMap.set(dateStr, price);
                    });
                }
                allPriceHistory.set(result.id, pricesMap);
            });

            const totalDays = differenceInDays(endDate, startDate);
            for (const pricesMap of allPriceHistory.values()) {
                let lastKnownPrice: number | undefined = undefined;
                for (let i = totalDays; i >= 0; i--) {
                    const currentDate = startOfDay(subDays(endDate, i));
                    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                    if (pricesMap.has(currentDateStr)) {
                        lastKnownPrice = pricesMap.get(currentDateStr);
                    } else if (lastKnownPrice !== undefined) {
                        pricesMap.set(currentDateStr, lastKnownPrice);
                    }
                }
            }

            setPriceHistory(allPriceHistory);
            
            const chartStartDate = subDays(endDate, chartPeriodInDays);
            const newChartData: PortfolioDataPoint[] = [];

            for (let i = chartPeriodInDays; i >= 0; i--) {
                const currentDate = startOfDay(subDays(endDate, i));
                const isValidDateForChart = isAfter(currentDate, chartStartDate) || currentDate.getTime() === chartStartDate.getTime();

                if (isValidDateForChart) {
                    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                    let dailyTotal = 0;

                    investments.forEach(inv => {
                        const isPurchased = inv.purchaseDate && !isAfter(new Date(inv.purchaseDate), currentDate);
                        if (isPurchased) {
                            const priceKey = inv.assetType === 'crypto' ? (inv.coinGeckoId || inv.id) : inv.symbol;
                            const historyForAsset = allPriceHistory.get(priceKey);
                            const priceForDay = historyForAsset?.get(currentDateStr);
                            
                            if (priceForDay) {
                                dailyTotal += inv.amount * priceForDay;
                            }
                        }
                    });
                    newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
                }
            }
            
            setPortfolioHistory(newChartData);
            setIsLoading(false);
        };

        fetchHistory().catch(error => {
            console.error("Error fetching portfolio history:", error);
            setIsLoading(false);
        });

    }, [investmentsKey, chartPeriodInDays]);

    return { portfolioHistory, isLoading, priceHistory };
}
