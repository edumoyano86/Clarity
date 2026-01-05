'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { usePrices } from './use-prices';
import { format, subDays, startOfDay, getUnixTime, fromUnixTime, isAfter } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';

export type PortfolioPeriod = 7 | 30 | 90;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function usePortfolioHistory(investments: Investment[], periodInDays: PortfolioPeriod = 90) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());
    const [totalValue, setTotalValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const { prices, isLoading: isLoadingPrices } = usePrices(investments || []);

    const investmentsKey = useMemo(() => investments?.map(i => `${i.id}-${i.amount}`).join(',') || '', [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || investments.length === 0 || isLoadingPrices) {
                setPortfolioHistory([]);
                setPriceHistory(new Map());
                setTotalValue(0);
                setIsLoading(false);
                return;
            }
             
            setIsLoading(true);

            const currentTotalValue = investments.reduce((acc, inv) => {
                const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                const currentPrice = prices[priceKey]?.price || 0;
                return acc + (inv.amount * currentPrice);
            }, 0);
            setTotalValue(currentTotalValue);
            
            const cryptoSymbols = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            const stockSymbols = [...new Set(investments.filter(i => i.assetType === 'stock').map(inv => inv.symbol))];

            const endDate = startOfDay(new Date());
            const startDate = subDays(endDate, periodInDays);
            const startTimestamp = getUnixTime(startDate);
            const endTimestamp = getUnixTime(endDate);

            const allPriceHistory: PriceHistory = new Map();

            // --- Fetch Crypto History from Finnhub ---
            const cryptoPromises = cryptoSymbols.map(async (symbol) => {
                await delay(350); // Rate limit
                const resolution = 'D'; // Always use daily for history consistency
                return fetch(`https://finnhub.io/api/v1/crypto/candle?symbol=${symbol}&resolution=${resolution}&from=${startTimestamp}&to=${endTimestamp}&token=${process.env.NEXT_PUBLIC_FINNHUB_API_KEY}`)
                    .then(res => res.ok ? res.json() : Promise.reject(`Finnhub API failed for ${symbol}`))
                    .then(data => ({ symbol, data }));
            });
            
            const cryptoResults = await Promise.allSettled(cryptoPromises);
            cryptoResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value.data.c) {
                    const pricesMap = new Map<string, number>();
                    const { c, t } = result.value.data;
                    for (let i = 0; i < t.length; i++) {
                        pricesMap.set(format(startOfDay(fromUnixTime(t[i])), 'yyyy-MM-dd'), c[i]);
                    }
                    allPriceHistory.set(result.value.symbol, pricesMap);
                } else if (result.status === 'rejected') {
                    console.warn(`Could not fetch crypto history:`, result.reason);
                }
            });

            // --- Fetch Stock History ---
            const stockPromises = stockSymbols.map(async (symbol) => {
                await delay(350); // Rate limit
                return getStockPriceHistory({ symbol, from: startTimestamp, to: endTimestamp })
                           .then(data => ({ symbol, history: data.history }));
            });
            const stockResults = await Promise.allSettled(stockPromises);
            stockResults.forEach(result => {
                 if (result.status === 'fulfilled' && result.value.history) {
                    const pricesMap = new Map<string, number>();
                    Object.entries(result.value.history).forEach(([dateStr, price]) => {
                        pricesMap.set(dateStr, price);
                    });
                    allPriceHistory.set(result.value.symbol, pricesMap);
                 } else if (result.status === 'rejected') {
                    console.warn(`Could not fetch stock history:`, result.reason);
                 }
            });
            
            // --- Fill Price Gaps ---
            for (const [symbol, pricesMap] of allPriceHistory.entries()) {
                let lastKnownPrice: number | undefined = undefined;
                 for (let i = 0; i <= periodInDays; i++) {
                    const currentDate = startOfDay(subDays(endDate, periodInDays - i));
                    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                    if (pricesMap.has(currentDateStr)) {
                        lastKnownPrice = pricesMap.get(currentDateStr);
                    } else if (lastKnownPrice !== undefined) {
                        pricesMap.set(currentDateStr, lastKnownPrice);
                    }
                }
            }
            setPriceHistory(allPriceHistory);


            // --- Calculate Portfolio Value Over Time ---
            const newChartData: PortfolioDataPoint[] = [];

            for (let i = 0; i <= periodInDays; i++) {
                const currentDate = startOfDay(subDays(endDate, periodInDays - i));
                const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                let dailyTotal = 0;

                investments.forEach(inv => {
                    if (!isAfter(new Date(inv.purchaseDate), currentDate)) {
                        const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                        const historyForAsset = allPriceHistory.get(priceKey);
                        const priceForDay = historyForAsset?.get(currentDateStr) || 0; // It should always find a price now

                        dailyTotal += inv.amount * priceForDay;
                    }
                });
                newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
            }
            
             // Add today's value as the last point, using the most current prices
            newChartData.push({ date: new Date().getTime(), value: currentTotalValue });

            setPortfolioHistory(newChartData);
        };

        fetchHistory().catch(error => {
            console.error("Error fetching portfolio history:", error);
        }).finally(() => {
            setIsLoading(false);
        });

    }, [investmentsKey, isLoadingPrices, periodInDays]);

    return { portfolioHistory, totalValue, isLoading, priceHistory };
}
