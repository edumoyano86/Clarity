'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PriceHistory } from '@/lib/definitions';
import { format, startOfDay, getUnixTime, isAfter, differenceInDays, addDays } from 'date-fns';
import { getStockPriceHistory } from '@/ai/flows/stock-price-history';
import { getCryptoPriceHistory } from '@/ai/flows/crypto-price-history';

/**
 * A hook to fetch and prepare all historical price data needed for the portfolio.
 * It determines the full date range required from all investments and fetches
 * the daily prices for each asset. It also fills in missing data for non-trading days.
 * 
 * @param investments The user's list of investments.
 * @returns An object containing the complete price history map and a loading state.
 */
export function usePortfolioHistory(
    investments: Investment[] | null
) {
    const [priceHistory, setPriceHistory] = useState<PriceHistory>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    const investmentsKey = useMemo(() => {
        if (!investments) return 'no-investments';
        return investments.map(inv => `${inv.id}-${inv.amount}-${inv.purchaseDate}`).sort().join(',');
    }, [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || investments.length === 0) {
                setPriceHistory(new Map());
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            // 1. Determine the full date range needed.
            const earliestPurchaseDate = investments.reduce((earliest, inv) => {
                if (typeof inv.purchaseDate === 'number' && !isNaN(inv.purchaseDate) && inv.purchaseDate > 0) {
                    return Math.min(earliest, inv.purchaseDate);
                }
                return earliest;
            }, Date.now());

            const endDate = startOfDay(new Date());
            const historyStartDate = startOfDay(new Date(earliestPurchaseDate));
            const startTimestamp = getUnixTime(historyStartDate);
            const endTimestamp = getUnixTime(endDate);

            // 2. Identify all unique assets that need price history.
            const cryptoAssets = investments.filter(i => i.assetType === 'crypto' && i.coinGeckoId);
            const stockAssets = investments.filter(i => i.assetType === 'stock');
            const cryptoIdsToFetch = [...new Set(cryptoAssets.map(a => a.coinGeckoId!))];
            const stockSymbolsToFetch = [...new Set(stockAssets.map(a => a.symbol))];

            // 3. Fetch all price histories in parallel.
            const stockPromises = stockSymbolsToFetch.map(symbol =>
                getStockPriceHistory({ symbol: symbol, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ id: symbol, data: data.history }))
                    .catch(err => {
                        console.warn(`Could not fetch stock history for ${symbol}:`, err);
                        return { id: symbol, data: {} };
                    })
            );
            const cryptoPromises = cryptoIdsToFetch.map(id =>
                getCryptoPriceHistory({ id, from: startTimestamp, to: endTimestamp })
                    .then(data => ({ id, data: data.history }))
                    .catch(err => {
                        console.warn(`Could not fetch crypto history for ${id}:`, err);
                        return { id: id, data: {} };
                    })
            );
            
            const results = await Promise.all([...stockPromises, ...cryptoPromises]);
            
            // 4. Build the initial price history map.
            const allPriceHistory: PriceHistory = new Map();
            results.forEach(result => {
                if (result) {
                    const pricesMap = new Map<string, number>();
                    if (result.data) {
                        Object.entries(result.data).forEach(([dateStr, price]) => {
                            pricesMap.set(dateStr, price);
                        });
                    }
                    allPriceHistory.set(result.id, pricesMap);
                }
            });
            
            // 5. Fill forward missing prices for non-trading days (weekends, holidays).
            const totalDays = differenceInDays(endDate, historyStartDate);
            if (totalDays >= 0) {
                for (const pricesMap of allPriceHistory.values()) {
                    let lastKnownPrice: number | undefined;
                    for (let i = 0; i <= totalDays; i++) {
                        const currentDate = addDays(historyStartDate, i);
                        const dateStr = format(currentDate, 'yyyy-MM-dd');
                        if (pricesMap.has(dateStr)) {
                            lastKnownPrice = pricesMap.get(dateStr);
                        } else if (lastKnownPrice !== undefined) {
                            pricesMap.set(dateStr, lastKnownPrice);
                        }
                    }
                }
            }

            setPriceHistory(allPriceHistory);
            setIsLoading(false);
        };

        fetchHistory().catch(error => {
            console.error("Error fetching full portfolio history:", error);
            setIsLoading(false);
        });

    }, [investmentsKey]);

    return { priceHistory, isLoading };
}
