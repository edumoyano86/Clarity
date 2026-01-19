'use client';

import { useState, useEffect } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { format, subDays, startOfDay, getUnixTime, isAfter, differenceInDays, addDays } from 'date-fns';
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
            const cryptoIds = [...new Set(cryptoAssets.map(i => i.coinGeckoId || i.id).filter(Boolean))];
            const stockSymbols = [...new Set(stockAssets.map(i => i.symbol).filter(Boolean))];

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
                const priceKey = inv.assetType === 'crypto' ? (inv.coinGeckoId || inv.id) : inv.symbol;
                if (priceKey && fetchedPrices[priceKey]) {
                    newTotalValue += inv.amount * fetchedPrices[priceKey].price;
                }
            });
            setTotalValue(newTotalValue);

            // 3. Fetch history for the chart
            const chartStartDate = startOfDay(subDays(new Date(), period -1));
            const endDate = startOfDay(new Date());
            const startTimestamp = getUnixTime(chartStartDate);
            const endTimestamp = getUnixTime(endDate);

            const stockHistoryPromises = stockSymbols.map(symbol =>
                getStockPriceHistory({ symbol, from: startTimestamp, to: endTimestamp }).then(d => ({ id: symbol, data: d.history })).catch(() => ({ id: symbol, data: {} }))
            );
            const cryptoHistoryPromises = cryptoIds.map(id =>
                getCryptoPriceHistory({ id, from: startTimestamp, to: endTimestamp }).then(d => ({ id: id, data: d.history })).catch(() => ({ id: id, data: {} }))
            );
            
            const historyResults = await Promise.all([...stockHistoryPromises, ...cryptoHistoryPromises]);
            const tempPriceHistory: PriceHistory = new Map();
            historyResults.forEach(res => {
                const pricesMap = new Map<string, number>();
                if (res.data) {
                    Object.entries(res.data).forEach(([dateStr, price]) => pricesMap.set(dateStr, price));
                }
                tempPriceHistory.set(res.id, pricesMap);
            });
            
            // 4. Fill forward missing prices
            const chartDays = differenceInDays(endDate, chartStartDate);
            for (const pricesMap of tempPriceHistory.values()) {
                let lastKnownPrice: number | undefined;
                for (let i = 0; i <= chartDays; i++) {
                    const currentDate = addDays(chartStartDate, i);
                    const dateStr = format(currentDate, 'yyyy-MM-dd');
                    if (pricesMap.has(dateStr)) {
                        lastKnownPrice = pricesMap.get(dateStr);
                    } else if (lastKnownPrice !== undefined) {
                        pricesMap.set(dateStr, lastKnownPrice);
                    }
                }
            }

            // 5. Generate chart data
            const newChartData: PortfolioDataPoint[] = [];
            let lastKnownTotal: number | null = null;
            for (let i = 0; i <= chartDays; i++) {
                const currentDate = addDays(chartStartDate, i);
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                let dailyTotal = 0;
                let assetsWithValue = 0;

                investments.forEach(inv => {
                    if (!isAfter(new Date(inv.purchaseDate), currentDate)) {
                        const priceKey = inv.assetType === 'crypto' ? (inv.coinGeckoId || inv.id) : inv.symbol;
                        const priceForDay = tempPriceHistory.get(priceKey)?.get(dateStr);
                        if (priceForDay !== undefined) {
                            dailyTotal += inv.amount * priceForDay;
                            assetsWithValue++;
                        }
                    }
                });
                
                if (assetsWithValue > 0) {
                    lastKnownTotal = dailyTotal;
                    newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
                } else {
                    newChartData.push({ date: currentDate.getTime(), value: lastKnownTotal });
                }
            }
            setChartData(newChartData);
            setIsLoading(false);
        };

        processData();
    }, [investments, period]);

    return { chartData, totalValue, isLoading };
}
