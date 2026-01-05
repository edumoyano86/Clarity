'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { usePrices } from './use-prices';
import { format, subDays, startOfDay, getUnixTime, fromUnixTime, isAfter } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';

export type PortfolioPeriod = 7 | 30 | 90;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function usePortfolioHistory(investments: Investment[], periodInDays: PortfolioPeriod = 90) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [totalValue, setTotalValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const { prices, isLoading: isLoadingPrices } = usePrices(investments || []);

    const investmentsKey = useMemo(() => investments?.map(i => `${i.id}-${i.amount}`).join(',') || '', [investments]);

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

            // Calculate current total value
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
            const startTimestamp = getUnixTime(startDate);
            const endTimestamp = getUnixTime(endDate);

            const allPriceHistory: PriceHistory = new Map();

            // --- Fetch Crypto History ---
            if (cryptoIds.length > 0) {
                const resolution = periodInDays <= 30 ? 'hourly' : 'daily';
                const cryptoPromises = cryptoIds.map(id =>
                    fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${startTimestamp}&to=${endTimestamp}&precision=2`)
                        .then(res => res.ok ? res.json() : Promise.reject(`CoinGecko API failed for ${id}`))
                        .then(data => ({ id, prices: data.prices as [number, number][] }))
                );
                const cryptoResults = await Promise.allSettled(cryptoPromises);
                cryptoResults.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.prices) {
                        const pricesMap = new Map<string, number>();
                         result.value.prices.forEach(([ts, price]) => {
                            pricesMap.set(format(startOfDay(fromUnixTime(ts/1000)), 'yyyy-MM-dd'), price);
                        });
                        allPriceHistory.set(result.value.id, pricesMap);
                    }
                });
            }

            // --- Fetch Stock History ---
            const stockPromises = stockSymbols.map(async (symbol) => {
                // Finnhub free tier has a rate limit (e.g., 60 calls/min). Add delay.
                await delay(1100); // ~55 calls per minute
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
                 }
            });


            // --- Calculate Portfolio Value Over Time ---
            const newChartData: PortfolioDataPoint[] = [];
            const lastKnownPrices: { [key: string]: number } = {};

            // Initialize last known prices with current prices
            for (const inv of investments) {
                 const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                 lastKnownPrices[priceKey] = prices[priceKey]?.price || inv.purchasePrice;
            }

            for (let i = 0; i <= periodInDays; i++) {
                const currentDate = subDays(endDate, periodInDays - i);
                const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                const currentTimestamp = currentDate.getTime();
                let dailyTotal = 0;

                investments.forEach(inv => {
                    if (isAfter(currentDate, startOfDay(new Date(inv.purchaseDate))) || format(currentDate, 'yyyy-MM-dd') === format(new Date(inv.purchaseDate), 'yyyy-MM-dd')) {
                        const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                        const historyForAsset = allPriceHistory.get(priceKey);
                        
                        let priceToUse = lastKnownPrices[priceKey]; // Start with the most recent known price

                        if (historyForAsset && historyForAsset.has(currentDateStr)) {
                            priceToUse = historyForAsset.get(currentDateStr)!;
                            lastKnownPrices[priceKey] = priceToUse; // Update last known price
                        } else if (historyForAsset) {
                           // If no price for today, try to find the most recent one before today
                           let found = false;
                           for (let j = 1; j <= i; j++) {
                               const prevDateStr = format(subDays(currentDate, j), 'yyyy-MM-dd');
                               if (historyForAsset.has(prevDateStr)) {
                                   priceToUse = historyForAsset.get(prevDateStr)!;
                                   lastKnownPrices[priceKey] = priceToUse;
                                   found = true;
                                   break;
                               }
                           }
                           if (!found) {
                               priceToUse = inv.purchasePrice; // Ultimate fallback
                           }
                        } else {
                            priceToUse = inv.purchasePrice; // Fallback if no history at all
                        }
                        
                        // Override with today's price for the last point
                        if (i === periodInDays) {
                           priceToUse = prices[priceKey]?.price || priceToUse;
                        }

                        dailyTotal += inv.amount * priceToUse;
                    }
                });
                newChartData.push({ date: currentTimestamp, value: dailyTotal });
            }

            setPortfolioHistory(newChartData);
            setIsLoading(false);
        };

        fetchHistory().catch(error => {
            console.error("Error fetching portfolio history:", error);
            setIsLoading(false);
        });

    }, [investmentsKey, isLoadingPrices, periodInDays]);

    return { portfolioHistory, totalValue, isLoading };
}
