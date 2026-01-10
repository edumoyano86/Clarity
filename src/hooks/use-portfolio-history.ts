'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { format, subDays, startOfDay, getUnixTime, isAfter } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';
import { getCryptoPriceHistory } from '@/ai/flows/crypto-price-history';

export type PortfolioPeriod = 7 | 30 | 90;

export function usePortfolioHistory(
    investments: Investment[] | null,
    periodInDays: PortfolioPeriod = 90
) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    const investmentsKey = useMemo(() => investments?.map(inv => `${inv.id}-${inv.amount}`).join(',') || '', [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || investments.length === 0) {
                setPortfolioHistory([]);
                setPriceHistory(new Map());
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            
            const cryptoAssets = investments.filter(i => i.assetType === 'crypto');
            const stockAssets = investments.filter(i => i.assetType === 'stock');

            const endDate = startOfDay(new Date());
            const startDate = subDays(endDate, periodInDays);
            const startTimestamp = getUnixTime(startDate);
            const endTimestamp = getUnixTime(endDate);

            const allPriceHistory: PriceHistory = new Map();
            
            const stockPromises = stockAssets.map(asset => 
                getStockPriceHistory({ symbol: asset.symbol, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ symbol: asset.symbol, data: data.history }))
                    .catch(err => {
                        console.warn(`Could not fetch stock history for ${asset.symbol}:`, err);
                        return { symbol: asset.symbol, data: {} };
                    })
            );

            const cryptoPromises = cryptoAssets.map(asset => 
                getCryptoPriceHistory({ id: asset.symbol, from: startTimestamp, to: endTimestamp })
                     .then(data => ({ symbol: asset.symbol, data: data.history }))
                     .catch(err => {
                        console.warn(`Could not fetch crypto history for ${asset.symbol}:`, err);
                        return { symbol: asset.symbol, data: {} };
                    })
            );

            const results = await Promise.all([...stockPromises, ...cryptoPromises]);

            results.forEach(result => {
                if (result.data) {
                    const pricesMap = new Map<string, number>();
                    Object.entries(result.data).forEach(([dateStr, price]) => {
                        pricesMap.set(dateStr, price);
                    });
                    allPriceHistory.set(result.symbol, pricesMap);
                }
            });
            
            // Fill in missing weekend/holiday data by carrying forward the last known price
            for (const pricesMap of allPriceHistory.values()) {
                let lastKnownPrice: number | undefined = undefined;
                // Iterate backwards from today
                for (let i = 0; i <= periodInDays; i++) {
                    const currentDate = startOfDay(subDays(endDate, i));
                    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                    
                    const currentPrice = pricesMap.get(currentDateStr);
                    if (currentPrice !== undefined && currentPrice > 0) {
                        lastKnownPrice = currentPrice;
                    } else if (lastKnownPrice !== undefined) {
                        pricesMap.set(currentDateStr, lastKnownPrice);
                    }
                }
            }
            setPriceHistory(allPriceHistory);

            const newChartData: PortfolioDataPoint[] = [];
            for (let i = periodInDays; i >= 0; i--) {
                const currentDate = startOfDay(subDays(endDate, i));
                const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                let dailyTotal = 0;

                investments.forEach(inv => {
                    const purchaseDate = startOfDay(new Date(inv.purchaseDate));
                    if (!isAfter(purchaseDate, currentDate)) {
                        const historyForAsset = allPriceHistory.get(inv.symbol);
                        const priceForDay = historyForAsset?.get(currentDateStr);
                        
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

    }, [investmentsKey, periodInDays]);

    return { portfolioHistory, isLoading, priceHistory };
}
