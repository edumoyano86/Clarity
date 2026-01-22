'use client';

import { useState, useEffect } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { subDays, startOfDay, getUnixTime, isAfter, differenceInDays, addDays } from 'date-fns';
import { getCryptoPriceHistory } from '@/ai/flows/crypto-price-history';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
import { getStockPrices } from '@/ai/flows/stock-prices';

export type PortfolioPeriod = 7 | 30 | 90;

export function useDashboardPortfolio(
    investments: Investment[] | null,
    period: PortfolioPeriod
) {
    const [chartData, setChartData] = useState<PortfolioDataPoint[]>([]);
    const [totalValue, setTotalValue] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const processData = async () => {
            if (!investments) {
                setIsLoading(false);
                return;
            }
            
            if (investments.length === 0) {
                setChartData([]);
                setTotalValue(0);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            // 1. Get asset lists
            const cryptoAssets = investments.filter(i => i.assetType === 'crypto');
            const stockAssets = investments.filter(i => i.assetType === 'stock');
            const cryptoIds = [...new Set(cryptoAssets.map(i => i.coinGeckoId).filter((id): id is string => !!id))];
            const stockSymbols = [...new Set(stockAssets.map(i => i.symbol).filter((sym): sym is string => !!sym))];


            // 2. Fetch current prices for total value
            let fetchedPrices: { [key: string]: { price: number } } = {};
            try {
                const pricePromises = [];
                if (cryptoIds.length > 0) pricePromises.push(getCryptoPrices({ ids: cryptoIds }));
                if (stockSymbols.length > 0) pricePromises.push(getStockPrices({ symbols: stockSymbols }));

                const results = await Promise.allSettled(pricePromises);
                results.forEach(res => {
                    if (res.status === 'fulfilled' && res.value) {
                        fetchedPrices = { ...fetchedPrices, ...res.value };
                    }
                });
            } catch (e) {
                console.error("Dashboard: Failed to fetch prices", e);
            }

            let newTotalValue = 0;
            investments.forEach(inv => {
                const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId : inv.symbol;
                if (priceKey && fetchedPrices[priceKey]) {
                    newTotalValue += inv.amount * fetchedPrices[priceKey].price;
                }
            });
            setTotalValue(newTotalValue);

            // 3. Fetch history for the chart
            const chartPeriodStartDate = startOfDay(subDays(new Date(), period -1));
            const earliestPurchaseDate = investments.reduce((earliest, inv) => 
                (inv.purchaseDate && inv.purchaseDate < earliest) ? inv.purchaseDate : earliest, 
                Date.now()
            );

            const historyFetchStartDate = isAfter(new Date(earliestPurchaseDate), chartPeriodStartDate) 
                ? startOfDay(new Date(earliestPurchaseDate))
                : chartPeriodStartDate;

            const endDate = new Date();
            const startTimestamp = getUnixTime(historyFetchStartDate);
            const endTimestamp = getUnixTime(endDate);

            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            const historyResults: { id: string; data: Record<string, number> | {} }[] = [];

            for (const symbol of stockSymbols) {
                try {
                    const history = await getStockPriceHistory({ symbol, from: startTimestamp, to: endTimestamp });
                    historyResults.push({ id: symbol, data: history.history });
                } catch (e) {
                    console.warn(`Dashboard: Could not fetch stock history for ${symbol}:`, e)
                    historyResults.push({ id: symbol, data: {} });
                }
                await delay(2100); // Avoid Finnhub rate limit
            }

            for (const id of cryptoIds) {
                try {
                    const history = await getCryptoPriceHistory({ id, from: startTimestamp, to: endTimestamp });
                    historyResults.push({ id: id, data: history.history });
                } catch (e) {
                    console.warn(`Dashboard: Could not fetch crypto history for ${id}:`, e)
                    historyResults.push({ id: id, data: {} });
                }
                await delay(2100); // Avoid CoinGecko rate limit
            }
            
            const tempPriceHistory: PriceHistory = new Map();
            historyResults.forEach(res => {
                const pricesMap = new Map<string, number>();
                if (res.data) {
                    Object.entries(res.data).forEach(([dateStr, price]) => {
                         const date = new Date(dateStr);
                         const utcDateStr = date.toISOString().split('T')[0];
                         pricesMap.set(utcDateStr, price)
                    });
                }
                tempPriceHistory.set(res.id, pricesMap);
            });
            
            // 4. Fill forward missing prices
            const totalDaysInHistory = differenceInDays(endDate, historyFetchStartDate);
            if (totalDaysInHistory >= 0) {
                 for (const pricesMap of tempPriceHistory.values()) {
                    let lastKnownPrice: number | undefined;
                    for (let i = 0; i <= totalDaysInHistory; i++) {
                        const currentDate = addDays(historyFetchStartDate, i);
                        const dateStr = currentDate.toISOString().split('T')[0];
                        if (pricesMap.has(dateStr)) {
                            lastKnownPrice = pricesMap.get(dateStr);
                        } else if (lastKnownPrice !== undefined) {
                            pricesMap.set(dateStr, lastKnownPrice);
                        }
                    }
                }
            }

            // 5. Generate chart data
            const chartDataStartDate = startOfDay(subDays(new Date(), period - 1));
            const chartDays = differenceInDays(new Date(), chartDataStartDate);
            const newChartData: PortfolioDataPoint[] = [];
            let lastKnownTotal: number | null = null;
            
            for (let i = 0; i <= chartDays; i++) {
                const currentDate = addDays(chartDataStartDate, i);
                const dateStr = currentDate.toISOString().split('T')[0];
                let dailyTotal = 0;
                let assetsWithValue = 0;

                investments.forEach(inv => {
                    if (isAfter(new Date(inv.purchaseDate), currentDate)) {
                        return;
                    }

                    const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId : inv.symbol;
                    if (!priceKey) return;
                    
                    const historyForAsset = tempPriceHistory.get(priceKey);
                    const priceForDay = historyForAsset?.get(dateStr);

                    if (priceForDay !== undefined) {
                        dailyTotal += inv.amount * priceForDay;
                        assetsWithValue++;
                    }
                });
                
                if (assetsWithValue > 0) {
                    lastKnownTotal = dailyTotal;
                    newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
                } else if (lastKnownTotal !== null) {
                    newChartData.push({ date: currentDate.getTime(), value: lastKnownTotal });
                } else {
                    newChartData.push({ date: currentDate.getTime(), value: null });
                }
            }

            setChartData(newChartData);
            setIsLoading(false);
        };

        processData();
    }, [investments, period]);

    return { chartData, totalValue, isLoading };
}
