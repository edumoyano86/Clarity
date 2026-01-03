'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Investment, PriceData } from '@/lib/definitions';
import { Loader2 } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

interface PortfolioChartProps {
    investments: Investment[];
    prices: PriceData;
    isLoading: boolean;
}

const chartConfig = {
    value: {
        label: 'Valor (USD)',
        color: 'hsl(var(--chart-1))',
    },
} satisfies ChartConfig;

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function PortfolioChart({ investments, prices, isLoading: isLoadingPrices }: PortfolioChartProps) {
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [totalValue, setTotalValue] = useState(0);

    const investmentsKey = useMemo(() => investments.map(i => i.id).join(','), [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || investments.length === 0 || isLoadingPrices) {
                setHistoryData([]);
                const currentTotalValue = investments?.reduce((acc, inv) => {
                    const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                    const currentPrice = prices[priceKey]?.price || 0;
                    return acc + (inv.amount * currentPrice);
                }, 0) || 0;
                setTotalValue(currentTotalValue);
                setIsLoadingHistory(false);
                return;
            }

            setIsLoadingHistory(true);
            const cryptoIds = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];

            const endDate = new Date();
            const startDate = subDays(endDate, 90);

            const promises = cryptoIds.map(id => 
                fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${startDate.getTime() / 1000}&to=${endDate.getTime() / 1000}`)
                    .then(res => {
                        if (!res.ok) return { id, prices: null };
                        return res.json().then(data => ({ id, prices: data.prices }));
                    })
                    .catch(() => ({ id, prices: null }))
            );
            
            const results = await Promise.allSettled(promises);
            
            const successfulResults = results
                .filter(result => result.status === 'fulfilled' && result.value.prices)
                .map(result => (result as PromiseFulfilledResult<any>).value);
            
            // Create a map for easy price lookup by date string 'yyyy-MM-dd'
            const priceHistoryMap = new Map<string, Map<string, number>>();
            successfulResults.forEach(result => {
                result.prices.forEach(([timestamp, price]: [number, number]) => {
                    const dateStr = format(new Date(timestamp), 'yyyy-MM-dd');
                    if (!priceHistoryMap.has(dateStr)) {
                        priceHistoryMap.set(dateStr, new Map());
                    }
                    priceHistoryMap.get(dateStr)!.set(result.id, price);
                });
            });

            // Generate chart data for the last 90 days
            const chartData = [];
            for (let i = 0; i <= 90; i++) {
                const date = subDays(endDate, 90 - i);
                const dateStr = format(date, 'yyyy-MM-dd');
                const dayTimestamp = startOfDay(date).getTime();

                let dailyTotal = 0;
                investments.forEach(inv => {
                    if (inv.purchaseDate <= dayTimestamp) {
                        let price = 0;
                        if (inv.assetType === 'crypto') {
                            // Find the closest available historical price
                            let searchDate = date;
                            let historicalPrice: number | undefined;
                            for (let j = 0; j < 7; j++) { // Search back up to 7 days
                                const searchStr = format(searchDate, 'yyyy-MM-dd');
                                historicalPrice = priceHistoryMap.get(searchStr)?.get(inv.assetId);
                                if (historicalPrice) break;
                                searchDate = subDays(searchDate, 1);
                            }
                            price = historicalPrice || prices[inv.assetId]?.price || inv.purchasePrice;
                        } else { // stock
                            price = prices[inv.symbol]?.price || inv.purchasePrice;
                        }
                        dailyTotal += inv.amount * price;
                    }
                });
                chartData.push({ date: dayTimestamp, value: dailyTotal });
            }

            const currentTotalValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;

            setTotalValue(currentTotalValue);
            setHistoryData(chartData);
            setIsLoadingHistory(false);
        };

        fetchHistory();

    }, [investmentsKey, isLoadingPrices]); // Removed 'prices' dependency to avoid re-triggering

    const showLoadingState = isLoadingPrices || isLoadingHistory;
    const hasData = historyData.length > 0 && historyData.some(d => d.value > 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Evolución del Portafolio</CardTitle>
                <CardDescription>
                    Valor total del portafolio en los últimos 90 días. Valor actual: {formatCurrency(totalValue)}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                    {showLoadingState && (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {!showLoadingState && hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historyData} margin={{ left: 12, right: 12, top: 10 }}>
                                <defs>
                                    <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => format(new Date(value), "MMM d")}
                                    minTickGap={20}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => formatCurrency(value as number)}
                                    domain={['dataMin', 'dataMax']}
                                />
                                <Tooltip
                                    content={<ChartTooltipContent
                                        formatter={(value) => formatCurrency(value as number)}
                                        labelFormatter={(label) => format(new Date(Number(label)), "PPP")}
                                        indicator="dot"
                                    />}
                                />
                                <Area
                                    dataKey="value"
                                    type="monotone"
                                    fill="url(#fillValue)"
                                    stroke="var(--color-value)"
                                    stackId="a"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : null}
                    {!showLoadingState && !hasData && (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-muted-foreground text-center">
                                No hay suficientes datos históricos para mostrar el gráfico de evolución.
                            </p>
                        </div>
                    )}
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
