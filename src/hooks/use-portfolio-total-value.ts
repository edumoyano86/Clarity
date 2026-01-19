'use client';

import { useMemo } from 'react';
import { Investment, PriceData } from '@/lib/definitions';

/**
 * A hook to compute the current total value of the portfolio.
 * It uses the current prices and the list of investments.
 * 
 * @param investments The user's list of investments.
 * @param currentPrices The map of current prices for all assets.
 * @returns An object containing the `totalValue`.
 */
export function usePortfolioTotalValue(
    investments: Investment[] | null,
    currentPrices: PriceData
) {
    const totalValue = useMemo(() => {
        if (!investments || !currentPrices) return 0;
        
        let currentTotal = 0;
        investments.forEach(inv => {
            // Determine the correct key to look up the price
            const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId : inv.symbol;
            
            // If the key exists, get the price and add to the total
            if (priceKey && currentPrices[priceKey]) {
                const price = currentPrices[priceKey].price;
                currentTotal += inv.amount * price;
            }
        });
        return currentTotal;

    }, [investments, currentPrices]);

    return { totalValue };
}
