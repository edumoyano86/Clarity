'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PortfolioDataPoint, PriceHistory } from '@/lib/definitions';
import { format, subDays, startOfDay, isAfter, differenceInDays, addDays } from 'date-fns';

export type PortfolioPeriod = 7 | 30 | 90;

/**
 * A hook to compute the portfolio's daily value over a specified period for charting.
 * It takes the full price history and investments list and generates the data points.
 * 
 * @param investments The user's list of investments.
 * @param priceHistory The complete map of historical prices for all assets.
 * @param chartPeriodInDays The number of days to include in the chart data (e.g., 7, 30, 90).
 * @returns An object containing the `chartData` array.
 */
export function usePortfolioChartData(
    investments: Investment[] | null,
    priceHistory: PriceHistory,
    chartPeriodInDays: PortfolioPeriod = 90
) {
    const [chartData, setChartData] = useState<PortfolioDataPoint[]>([]);

    useEffect(() => {
        if (!investments || investments.length === 0 || priceHistory.size === 0) {
            setChartData([]);
            return;
        }

        const endDate = startOfDay(new Date());
        const chartStartDate = startOfDay(subDays(endDate, chartPeriodInDays -1));
        const chartDays = differenceInDays(endDate, chartStartDate) + 1;
        const newChartData: PortfolioDataPoint[] = [];

        for (let i = 0; i < chartDays; i++) {
            const currentDate = addDays(chartStartDate, i);
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            let dailyTotal = 0;

            investments.forEach(inv => {
                // Skip legacy or invalid investments
                if ((inv.assetType === 'crypto' && !inv.coinGeckoId) || typeof inv.purchaseDate !== 'number') return;
                
                // Only include the investment if it was purchased on or before the current day
                if (!isAfter(new Date(inv.purchaseDate), currentDate)) {
                    const priceKey = inv.assetType === 'crypto' ? inv.coinGeckoId! : inv.symbol;
                    const historyForAsset = priceHistory.get(priceKey);
                    const priceForDay = historyForAsset?.get(dateStr);
                    
                    if (priceForDay !== undefined) {
                        dailyTotal += inv.amount * priceForDay;
                    }
                }
            });
            newChartData.push({ date: currentDate.getTime(), value: dailyTotal });
        }
        
        setChartData(newChartData);

    }, [investments, priceHistory, chartPeriodInDays]);

    return { chartData };
}
