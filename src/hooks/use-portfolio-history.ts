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

    const investmentsKey = useMemo(() => investments?.map(inv => inv.id).join(','), [investments]);

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

            // Calculate current total value using the prices passed as props
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

            // Fetch crypto history using server-side flow (assuming one exists or is created)
            const cryptoPromises = cryptoSymbols.map(async (symbol) => {
                // IMPORTANT: This assumes a Genkit flow `getCryptoPriceHistory` exists.
                // For now, we mock this by calling Finnhub from server, but ideally it's a flow.
                await delay(350); // Rate limiting
                const url = `https://finnhub.io/api/v1/crypto/candle?symbol=${symbol}&resolution=D&from=${startTimestamp}&to=${endTimestamp}&token=${process.env.NEXT_PUBLIC_FINNHUB_API_KEY}`;
                return fetch(url)
                    .then(res => res.ok ? res.json() : Promise.reject(`Finnhub API failed for ${symbol}`))
                    .then(data => ({ symbol, data }));
            });
            
            // Fetch stock history using the existing Genkit flow
            const stockPromises = stockSymbols.map(async (symbol) => {
                await delay(350); // Rate limiting
                return getStockPriceHistory({ symbol, from: startTimestamp, to: endTimestamp })
                           .then(data => ({ symbol, history: data.history }));
            });
            
            // Settle all promises
            const [cryptoResults, stockResults] = await Promise.all([
                Promise.allSettled(cryptoPromises),
                Promise.allSettled(stockPromises),
            ]);

            // Process crypto results
            cryptoResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value.data?.c) {
                    const pricesMap = new Map<string, number>();
                    const { c, t } = result.value.data;
                    for (let i = 0; i < t.length; i++) {
                        pricesMap.set(format(fromUnixTime(t[i]), 'yyyy-MM-dd'), c[i]);
                    }
                    allPriceHistory.set(result.value.symbol, pricesMap);
                } else if (result.status === 'rejected') {
                    console.warn(`Could not fetch crypto history:`, result.reason);
                }
            });

            // Process stock results
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
            
            // Fill gaps in price history
            for (const pricesMap of allPriceHistory.values()) {
                let lastKnownPrice: number | undefined = undefined;
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

            // Calculate portfolio value for each day in the period
            const newChartData: PortfolioDataPoint[] = [];
            for (let i = periodInDays; i >= 0; i--) {
                const currentDate = startOfDay(subDays(endDate, i));
                const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                let dailyTotal = 0;

                investments.forEach(inv => {
                    const purchaseDate = startOfDay(new Date(inv.purchaseDate));
                    // Check if the investment existed on the current date
                    if (!isAfter(purchaseDate, currentDate)) {
                        const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                        const historyForAsset = allPriceHistory.get(priceKey);
                        const priceForDay = historyForAsset?.get(currentDateStr);
                        
                        if(priceForDay) {
                           dailyTotal += inv.amount * priceForDay;
                        } else {
                           // If no price is found for a past day, use the earliest available price as a fallback
                           const earliestPrice = historyForAsset ? Array.from(historyForAsset.values())[0] : 0;
                           dailyTotal += inv.amount * earliestPrice;
                        }
                    }
                });
                newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
            }
            
            // Ensure the last point in the chart is the most up-to-date total value
            if (newChartData.length > 0 && currentTotalValue > 0) {
                 newChartData[newChartData.length - 1].value = currentTotalValue;
            }

            setPortfolioHistory(newChartData);
            setIsLoading(false);
        };

        // Only run if we have investments and current prices are ready
        if (investments && investments.length > 0 && Object.keys(currentPrices).length > 0) {
            fetchHistory().catch(error => {
                console.error("Error fetching portfolio history:", error);
                setIsLoading(false);
            });
        } else if (!investments || investments.length === 0) {
             setIsLoading(false);
        }

    }, [investmentsKey, periodInDays, currentPrices]); // Rerun when investments, period, or currentPrices change

    return { portfolioHistory, totalValue, isLoading, priceHistory };
}
