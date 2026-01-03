'use client';

import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Investment, PriceData } from '@/lib/definitions';
import { Loader2 } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
import { getStockPrices } from '@/ai/flows/stock-prices';


interface PortfolioChartProps {
    investments: Investment[];
    prices: PriceData;
    isLoading: boolean;
};

const chartConfig = {
  value: {
    label: 'Valor del Portafolio',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

export function PortfolioChart({ investments, prices, isLoading: isLoadingPrices }: PortfolioChartProps) {
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || investments.length === 0) {
                setHistoryData([]);
                return;
            };

            setIsLoadingHistory(true);
            const endDate = new Date();
            const startDate = subDays(endDate, 90);
            
            const cryptoIds = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            
            // NOTE: We are skipping stock history for now as Finnhub free tier only allows 1 year of daily data, not specific date ranges.
            // This is a limitation we can address in a future iteration with a different API or paid plan.
            
            const historyPromises = cryptoIds.map(id => 
                fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${startDate.getTime() / 1000}&to=${endDate.getTime() / 1000}`)
                    .then(res => res.json())
                    .then(data => ({ id, prices: data.prices }))
            );

            const results = await Promise.all(historyPromises);
            const priceHistory: { [id: string]: { [date: string]: number } } = {};
            
            results.forEach(result => {
                if (result.prices) {
                    priceHistory[result.id] = {};
                    result.prices.forEach(([timestamp, price]: [number, number]) => {
                        const dateStr = format(startOfDay(new Date(timestamp)), 'yyyy-MM-dd');
                        priceHistory[result.id][dateStr] = price;
                    });
                }
            });

            const timeline: any[] = [];
            for (let d = startOfDay(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const currentDate = new Date(d);
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                let dailyTotalValue = 0;

                investments.forEach(inv => {
                    if (inv.purchaseDate > currentDate.getTime()) return; // Investment not yet made

                    if (inv.assetType === 'crypto') {
                        // Find the closest available historical price going backwards
                        let historicalPrice: number | undefined;
                        for (let i = 0; i <= 5; i++) { // Check up to 5 days back
                            const checkDate = subDays(currentDate, i);
                            const checkDateStr = format(checkDate, 'yyyy-MM-dd');
                            if (priceHistory[inv.assetId]?.[checkDateStr]) {
                                historicalPrice = priceHistory[inv.assetId][checkDateStr];
                                break;
                            }
                        }
                        if (historicalPrice) {
                            dailyTotalValue += inv.amount * historicalPrice;
                        }
                    } else { // Stock
                        // For stocks, use the current price for all historical points as a fallback
                         const priceKey = inv.symbol;
                         const currentPrice = prices[priceKey]?.price;
                         if (currentPrice) {
                            dailyTotalValue += inv.amount * currentPrice;
                         }
                    }
                });

                if (dailyTotalValue > 0) {
                  timeline.push({ date: currentDate.getTime(), value: dailyTotalValue });
                }
            }
            
            // Ensure there are at least two points for the area chart to render
            if (timeline.length === 1) {
                 timeline.unshift({ date: subDays(new Date(timeline[0].date), 1).getTime(), value: 0 });
            }


            setHistoryData(timeline);
            setIsLoadingHistory(false);
        };

        if(!isLoadingPrices) {
            fetchHistory();
        }

    }, [investments, isLoadingPrices, prices]);
  
  const showLoadingState = isLoadingPrices || isLoadingHistory;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución del Portafolio (90d)</CardTitle>
        <CardDescription>Crecimiento del valor de tus inversiones a lo largo del tiempo.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
            {showLoadingState && (
                 <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}
            {!showLoadingState && historyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={historyData} margin={{ left: 12, right: 12 }}>
                     <defs>
                        <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.1}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => format(new Date(value), "dd MMM")}
                        type="number"
                        domain={['dataMin', 'dataMax']}
                    />
                    <YAxis 
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => formatCurrency(Number(value))}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip 
                        content={<ChartTooltipContent 
                            formatter={(value) => formatCurrency(value as number)}
                            labelFormatter={(label) => {
                                const date = new Date(Number(label));
                                if (date instanceof Date && !isNaN(date.getTime())) {
                                  return format(date, "PPP");
                                }
                                return "";
                            }}
                            indicator="dot"
                            />} 
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--color-value)" fill="url(#fillValue)" name="Valor" />
                </AreaChart>
                </ResponsiveContainer>
            ) : null}
            {!showLoadingState && historyData.length === 0 && (
                <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground text-center">
                        Añade tu primera inversión para ver la evolución del portafolio.
                    </p>
                </div>
            )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
