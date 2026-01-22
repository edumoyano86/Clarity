'use client';

import { useState, useEffect } from 'react';
import { Investment, PortfolioDataPoint, PriceData, PriceHistory } from '@/lib/definitions';
import { subDays, startOfDay, getUnixTime, isAfter, differenceInDays, addDays, min, max } from 'date-fns';
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

    const [currentPrices, setCurrentPrices] = useState<PriceData>({});
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());

    // Effect 1: Fetch all remote data when investments list changes.
    useEffect(() => {
        const fetchMasterData = async () => {
             if (!investments) {
                setIsLoading(false);
                return;
            }
            if (investments.length === 0) {
                setCurrentPrices({});
                setPriceHistory(new Map());
                setTotalValue(0);
                setChartData([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            // 1. Get asset lists
            const cryptoAssets = investments.filter(i => i.assetType === 'crypto');
            const stockAssets = investments.filter(i => i.assetType === 'stock');
            const cryptoIds = [...new Set(cryptoAssets.map(i => i.coinGeckoId).filter((id): id is string => !!id))];
            const stockSymbols = [...new Set(stockAssets.map(i => i.symbol).filter((sym): sym is string => !!sym))];

            // 2. Fetch current prices
            let fetchedPrices: PriceData = {};
            try {
                 if (cryptoIds.length > 0) {
                    const cryptoPrices = await getCryptoPrices({ ids: cryptoIds });
                    fetchedPrices = { ...fetchedPrices, ...cryptoPrices };
                }
                for (const symbol of stockSymbols) {
                    try {
                        const stockPrice = await getStockPrices({ symbol });
                        fetchedPrices = { ...fetchedPrices, ...stockPrice };
                    } catch (e) {
                         console.warn(`Dashboard: Could not fetch stock price for ${symbol}`, e);
                    }
                    await new Promise(resolve => setTimeout(resolve, 6000)); // Rate limit
                }
            } catch (e) {
                console.error("Dashboard: Failed to fetch prices", e);
            }
            setCurrentPrices(fetchedPrices);

            // 3. Fetch FULL 90-DAY history
            const earliestPurchaseDate = investments.reduce((earliest, inv) => 
                min([earliest, new Date(inv.purchaseDate)]), 
                new Date()
            );
            const historyFetchStartDate = min([earliestPurchaseDate, startOfDay(subDays(new Date(), 90))]);
            
            const endDate = new Date();
            const startTimestamp = getUnixTime(historyFetchStartDate);
            const endTimestamp = getUnixTime(endDate);

            const historyResults: { id: string; data: Record<string, number> }[] = [];
            const allAssets = [...stockSymbols.map(s => ({type: 'stock', id: s})), ...cryptoIds.map(c => ({type: 'crypto', id: c}))];
            
            for (const asset of allAssets) {
                try {
                    let history: { history: Record<string, number> };
                    if (asset.type === 'stock') {
                        history = await getStockPriceHistory({ symbol: asset.id, from: startTimestamp, to: endTimestamp });
                    } else {
                        history = await getCryptoPriceHistory({ id: asset.id, from: startTimestamp, to: endTimestamp });
                    }
                     historyResults.push({ id: asset.id, data: history.history || {} });
                } catch (e) {
                    console.warn(`Dashboard: Could not fetch history for ${asset.id}:`, e)
                    historyResults.push({ id: asset.id, data: {} });
                }
                await new Promise(resolve => setTimeout(resolve, 6000));
            }
            
            const tempPriceHistory: PriceHistory = new Map();
            historyResults.forEach(res => {
                const pricesMap = new Map<string, number>();
                if (res.data) {
                    Object.entries(res.data).forEach(([dateStr, price]) => {
                        pricesMap.set(dateStr, price);
                    });
                }
                tempPriceHistory.set(res.id, pricesMap);
            });
            
            const totalDaysInHistory = differenceInDays(endDate, historyFetchStartDate);
            if (totalDaysInHistory >= 0) {
                 for (const [assetId, pricesMap] of tempPriceHistory.entries()) {
                    // Fallback to current price if history is completely empty
                    const lastResortPrice = currentPrices[assetId]?.price;
                    
                    // BACKWARD PASS to fill missing data from the future
                    let nextKnownPrice: number | undefined;
                    for (let i = totalDaysInHistory; i >= 0; i--) {
                        const currentDate = addDays(historyFetchStartDate, i);
                        const dateStr = currentDate.toISOString().split('T')[0];
                        if (pricesMap.has(dateStr)) {
                            nextKnownPrice = pricesMap.get(dateStr);
                        } else if (nextKnownPrice !== undefined) {
                            pricesMap.set(dateStr, nextKnownPrice);
                        }
                    }

                    // FORWARD PASS to fill any remaining gaps from the past
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
                     // FINAL PASS: if still gaps, use last resort price
                    if (pricesMap.size === 0 && lastResortPrice !== undefined) {
                        for (let i = 0; i <= totalDaysInHistory; i++) {
                            const currentDate = addDays(historyFetchStartDate, i);
                            const dateStr = currentDate.toISOString().split('T')[0];
                            pricesMap.set(dateStr, lastResortPrice);
                        }
                    }
                }
            }
            setPriceHistory(tempPriceHistory);
            setIsLoading(false);
        };

        fetchMasterData();
    }, [investments]);
    
    // Effect 2: Process data and generate chart when period or master data changes
    useEffect(() => {
        if (isLoading || !investments || investments.length === 0) {
            return;
        }

        // 1. Calculate Total Value
        let newTotalValue = 0;
        investments.forEach(inv => {
            const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId : inv.symbol;
            if (priceKey && currentPrices[priceKey]) {
                newTotalValue += inv.amount * currentPrices[priceKey].price;
            }
        });
        setTotalValue(newTotalValue);

        // 2. Generate chart data
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
                
                const historyForAsset = priceHistory.get(priceKey);
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

    }, [period, priceHistory, currentPrices, investments, isLoading]);

    return { chartData, totalValue, isLoading };
}
