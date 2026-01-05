'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory, PriceData } from '@/lib/definitions';
import { format, subDays, startOfDay, getUnixTime, fromUnixTime, isAfter } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';

export type PortfolioPeriod = 7 | 30 | 90;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function usePortfolioHistory(
    investments: Investment[] | null, 
    periodInDays: PortfolioPeriod = 90,
    currentPrices: PriceData
) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());
    const [totalValue, setTotalValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const investmentsKey = useMemo(() => investments?.map(i => `${i.id}-${i.amount}`).join(',') || '', [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || investments.length === 0) {
                setPortfolioHistory([]);
                setPriceHistory(new Map());
                setTotalValue(0);
                setIsLoading(false);
                return;
            }
             
            setIsLoading(true);

            // Calculate current total value as soon as currentPrices are available
            const currentTotalValue = investments.reduce((acc, inv) => {
                const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                const currentPrice = currentPrices[priceKey]?.price || 0;
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
                const resolution = 'D';
                const url = `https://finnhub.io/api/v1/crypto/candle?symbol=${symbol}&resolution=${resolution}&from=${startTimestamp}&to=${endTimestamp}&token=${process.env.NEXT_PUBLIC_FINNHUB_API_KEY}`;
                return fetch(url)
                    .then(res => res.ok ? res.json() : Promise.reject(`Finnhub API failed for ${symbol}`))
                    .then(data => ({ symbol, data }));
            });
            
            // --- Fetch Stock History ---
            const stockPromises = stockSymbols.map(async (symbol) => {
                await delay(350); // Rate limit
                return getStockPriceHistory({ symbol, from: startTimestamp, to: endTimestamp })
                           .then(data => ({ symbol, history: data.history }));
            });
            
            const [cryptoResults, stockResults] = await Promise.all([
                Promise.allSettled(cryptoPromises),
                Promise.allSettled(stockPromises),
            ]);

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
            for (const pricesMap of allPriceHistory.values()) {
                let lastKnownPrice: number | undefined = undefined;
                // Iterate backwards from today to find the first price
                for (let i = 0; i <= periodInDays; i++) {
                     const currentDate = startOfDay(subDays(endDate, i));
                     const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                     if (pricesMap.has(currentDateStr)) {
                         lastKnownPrice = pricesMap.get(currentDateStr);
                         break;
                     }
                }
                // Iterate forwards from the start date to fill gaps
                for (let i = periodInDays; i >= 0; i--) {
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

            // --- Calculate Portfolio Value Over Time ---
            const newChartData: PortfolioDataPoint[] = [];
            for (let i = periodInDays; i >= 0; i--) {
                const currentDate = startOfDay(subDays(endDate, i));
                const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                let dailyTotal = 0;

                investments.forEach(inv => {
                    const purchaseDate = startOfDay(new Date(inv.purchaseDate));
                    if (!isAfter(purchaseDate, currentDate)) {
                        const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                        const historyForAsset = allPriceHistory.get(priceKey);
                        const priceForDay = historyForAsset?.get(currentDateStr);
                        
                        if(priceForDay) {
                           dailyTotal += inv.amount * priceForDay;
                        }
                    }
                });
                newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
            }
            
            // Ensure the last point is today's most current value if available
            if (newChartData.length > 0 && currentTotalValue > 0) {
                 newChartData[newChartData.length - 1].value = currentTotalValue;
            }

            setPortfolioHistory(newChartData);
            setIsLoading(false);
        };

        fetchHistory().catch(error => {
            console.error("Error fetching portfolio history:", error);
            setIsLoading(false);
        });

    }, [investmentsKey, periodInDays]);

    return { portfolioHistory, totalValue, isLoading, priceHistory };
}
