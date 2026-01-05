'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { usePrices } from './use-prices';
import { format, subDays, startOfDay, isSameDay, getUnixTime, fromUnixTime } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';

export type PortfolioPeriod = 7 | 30 | 90;

const getApiGranularity = (periodInDays: PortfolioPeriod) => {
    if (periodInDays <= 90) {
        return { coingecko: 'daily', alphaVantage: 'TIME_SERIES_DAILY' };
    }
    // Future implementation for longer periods could go here
    return { coingecko: 'daily', alphaVantage: 'TIME_SERIES_DAILY' };
};

export function usePortfolioHistory(investments: Investment[], periodInDays: PortfolioPeriod = 90) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [totalValue, setTotalValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const { prices, isLoading: isLoadingPrices } = usePrices(investments || []);

    const investmentsKey = useMemo(() => investments?.map(i => i.id + i.amount).join(',') || '', [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || isLoadingPrices) {
                if (!investments || investments.length === 0) {
                    setPortfolioHistory([]);
                    setTotalValue(0);
                    setIsLoading(false);
                }
                return;
            }

            setIsLoading(true);
            
            const currentTotalValue = investments.reduce((acc, inv) => {
                const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                const currentPrice = prices[priceKey]?.price || inv.purchasePrice;
                return acc + (inv.amount * currentPrice);
            }, 0);
            setTotalValue(currentTotalValue);

            const cryptoIds = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            const stockSymbols = [...new Set(investments.filter(i => i.assetType === 'stock').map(inv => inv.symbol))];

            const endDate = startOfDay(new Date());
            const startDate = subDays(endDate, periodInDays);
            
            const { coingecko: coingeckoGranularity } = getApiGranularity(periodInDays);


            // --- Fetch Crypto History ---
            const cryptoPromises = cryptoIds.map(id =>
                fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${getUnixTime(startDate)}&to=${getUnixTime(endDate)}&precision=2`)
                    .then(res => res.ok ? res.json() : Promise.reject(`CoinGecko API failed for ${id}`))
                    .then(data => ({ id, prices: data.prices as [number, number][] }))
            );

            // --- Fetch Stock History ---
            const stockPromises = stockSymbols.map(symbol =>
                getStockPriceHistory({ symbol })
                    .then(data => ({ symbol, history: data.history }))
            );

            const [cryptoResults, stockResults] = await Promise.all([
                Promise.allSettled(cryptoPromises),
                Promise.allSettled(stockPromises),
            ]);

            // --- Process API Results ---
            const priceHistoryMap: PriceHistory = new Map();

            cryptoResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value.prices) {
                    const dailyPrices = new Map<string, number>();
                    result.value.prices.forEach(([timestamp, price]) => {
                        dailyPrices.set(format(startOfDay(new Date(timestamp)), 'yyyy-MM-dd'), price);
                    });
                    priceHistoryMap.set(result.value.id, dailyPrices);
                } else if (result.status === 'rejected') {
                    console.warn(result.reason);
                }
            });

            stockResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value.history) {
                    const dailyPrices = new Map<string, number>();
                     Object.entries(result.value.history).forEach(([dateStr, price]) => {
                        dailyPrices.set(dateStr, price);
                    });
                    priceHistoryMap.set(result.value.symbol, dailyPrices);
                } else if (result.status === 'rejected') {
                    console.warn(result.reason);
                }
            });
            
            // --- Fill Price Gaps and Calculate Portfolio Value ---
            const newChartData: PortfolioDataPoint[] = [];
            const lastKnownPrices: { [key: string]: number } = {};

            for (let i = periodInDays; i >= 0; i--) {
                const date = subDays(endDate, i);
                const dayTimestamp = date.getTime();
                const dateStr = format(date, 'yyyy-MM-dd');
                
                let dailyTotal = 0;
                
                investments.forEach(inv => {
                    const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;

                    // Update last known price
                    const assetPriceHistory = priceHistoryMap.get(priceKey);
                    if (assetPriceHistory?.has(dateStr)) {
                        lastKnownPrices[priceKey] = assetPriceHistory.get(dateStr)!;
                    }
                    
                    if (inv.purchaseDate <= dayTimestamp) {
                        let priceToUse: number;
                         const isToday = isSameDay(date, endDate);

                        if (isToday) {
                            priceToUse = prices[priceKey]?.price || lastKnownPrices[priceKey] || inv.purchasePrice;
                        } else {
                            priceToUse = lastKnownPrices[priceKey] || inv.purchasePrice;
                        }
                        dailyTotal += inv.amount * priceToUse;
                    }
                });
                newChartData.push({ date: dayTimestamp, value: dailyTotal });
            }
            
            setPortfolioHistory(newChartData);
            setIsLoading(false);
        };

        fetchHistory().catch(error => {
            console.error("Error fetching portfolio history:", error);
            setIsLoading(false);
        });

    }, [investmentsKey, isLoadingPrices, periodInDays, prices]);

    return { portfolioHistory, totalValue, isLoading };
}
