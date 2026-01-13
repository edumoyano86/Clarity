'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { format, subDays, startOfDay, getUnixTime, isAfter, differenceInDays } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';
import { getCryptoPriceHistory } from '@/ai/flows/crypto-price-history';
import { useToast } from './use-toast';

export type PortfolioPeriod = 7 | 30 | 90;

export function usePortfolioHistory(
    investments: Investment[] | null,
    chartPeriodInDays: PortfolioPeriod = 90
) {
    const [portfolioHistory, setPortfolioHistory] = useState<PortfolioDataPoint[]>([]);
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

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

            const earliestPurchaseDate = investments.reduce((earliest, inv) => {
                if (inv.purchaseDate && inv.purchaseDate < earliest) {
                    return inv.purchaseDate;
                }
                return earliest;
            }, Date.now());

            const endDate = startOfDay(new Date());
            const startDate = startOfDay(new Date(earliestPurchaseDate));
            const startTimestamp = getUnixTime(startDate);
            const endTimestamp = getUnixTime(endDate);

            const cryptoAssets = investments.filter(i => i.assetType === 'crypto');
            const stockAssets = investments.filter(i => i.assetType === 'stock');

            const allPriceHistory: PriceHistory = new Map();

            // Correctly get the identifiers for each API
            const cryptoIdsToFetch = [...new Set(cryptoAssets.map(a => a.coinGeckoId || a.id).filter(Boolean))];
            const stockSymbolsToFetch = [...new Set(stockAssets.map(a => a.symbol))];

            const stockPromises = stockSymbolsToFetch.map(symbol =>
                getStockPriceHistory({ symbol: symbol, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ id: symbol, data: data.history }))
                    .catch(err => {
                        console.warn(`Could not fetch stock history for ${symbol}:`, err);
                        toast({ title: 'Error de Historial', description: `No se pudo obtener el historial para ${symbol}.`, variant: 'destructive'});
                        return { id: symbol, data: {} };
                    })
            );

            const cryptoPromises = cryptoIdsToFetch.map(id =>
                getCryptoPriceHistory({ id, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ id, data: data.history }))
                    .catch(err => {
                        console.warn(`Could not fetch crypto history for ${id}:`, err);
                        toast({ title: 'Error de Historial', description: `No se pudo obtener el historial para ${id}.`, variant: 'destructive'});
                        return { id: id, data: {} };
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
                // Key in the main map is the CoinGecko ID for crypto, or symbol for stocks
                allPriceHistory.set(result.id, pricesMap);
            });

            // Backfill missing dates (weekends, holidays)
            const totalDays = differenceInDays(endDate, startDate);
            for (const pricesMap of allPriceHistory.values()) {
                let lastKnownPrice: number | undefined = undefined;
                // Iterate backwards to find the first price, then forward to fill
                 for (let i = 0; i <= totalDays; i++) {
                    const currentDate = startOfDay(subDays(endDate, totalDays - i));
                    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                    if (pricesMap.has(currentDateStr)) {
                        lastKnownPrice = pricesMap.get(currentDateStr);
                    }
                 }

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
            
            const chartStartDate = subDays(endDate, chartPeriodInDays -1);
            const newChartData: PortfolioDataPoint[] = [];

            for (let i = chartPeriodInDays - 1; i >= 0; i--) {
                const currentDate = startOfDay(subDays(endDate, i));
                
                const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                let dailyTotal = 0;

                investments.forEach(inv => {
                    const isPurchased = inv.purchaseDate && !isAfter(startOfDay(new Date(inv.purchaseDate)), currentDate);
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
            
            setPortfolioHistory(newChartData);
            setIsLoading(false);
        };

        fetchHistory().catch(error => {
            console.error("Error fetching portfolio history:", error);
            setIsLoading(false);
        });

    }, [investmentsKey, chartPeriodInDays, toast]);

    return { portfolioHistory, isLoading, priceHistory };
}
