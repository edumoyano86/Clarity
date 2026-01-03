'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Investment, PriceData } from '@/lib/definitions';
import { Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';

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

const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'dd/MM/yy');
}

export function PortfolioChart({ investments, prices, isLoading: isLoadingPrices }: PortfolioChartProps) {
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [totalValue, setTotalValue] = useState(0);

    const investmentsKey = useMemo(() => investments.map(i => i.id).join(','), [investments]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!investments || investments.length === 0 || isLoadingPrices) {
                setHistoryData([]);
                return;
            }

            setIsLoadingHistory(true);
            const cryptoIds = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            
            if (cryptoIds.length === 0) {
                 // If only stocks, we can't get history easily, so just show current value or flat line.
                setIsLoadingHistory(false);
                setHistoryData([]); // Or create a flat line based on current stock prices
                return;
            }

            const endDate = new Date();
            const startDate = subDays(endDate, 90);

            const promises = cryptoIds.map(id => 
                fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${startDate.getTime() / 1000}&to=${endDate.getTime() / 1000}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`Failed for ${id}`);
                        return res.json();
                    })
                    .then(data => ({ id, prices: data.prices }))
            );
            
            const results = await Promise.allSettled(promises);

            const successfulResults = results
                .filter(result => result.status === 'fulfilled')
                .map(result => (result as PromiseFulfilledResult<any>).value);

            // Process data
            const portfolioHistory: { [date: string]: number } = {};

            const dateRange = Array.from({ length: 91 }, (_, i) => {
                return format(subDays(endDate, 90 - i), 'yyyy-MM-dd');
            });

            dateRange.forEach(dateStr => {
                portfolioHistory[dateStr] = 0;
            });
            
            investments.forEach(investment => {
                const history = successfulResults.find(r => r.id === investment.assetId);
                const currentPrice = prices[investment.assetType === 'crypto' ? investment.assetId : investment.symbol]?.price || 0;

                if (history && history.prices) {
                    history.prices.forEach(([timestamp, price]: [number, number]) => {
                        const dateStr = format(new Date(timestamp), 'yyyy-MM-dd');
                        if (portfolioHistory.hasOwnProperty(dateStr) && investment.purchaseDate <= timestamp) {
                            portfolioHistory[dateStr] += investment.amount * price;
                        }
                    });
                } else if(investment.assetType === 'stock') {
                    // For stocks, create a flat line with current price for the days the user held it
                    dateRange.forEach(dateStr => {
                        if (investment.purchaseDate <= new Date(dateStr).getTime()) {
                             portfolioHistory[dateStr] += investment.amount * currentPrice;
                        }
                    });
                }
            });

            const finalChartData = Object.entries(portfolioHistory).map(([date, value]) => ({
                date,
                value
            }));

            const currentTotalValue = investments.reduce((acc, inv) => {
                const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
                const currentPrice = prices[priceKey]?.price || 0;
                return acc + (inv.amount * currentPrice);
            }, 0);

            setTotalValue(currentTotalValue);
            setHistoryData(finalChartData);
            setIsLoadingHistory(false);
        };

        fetchHistory();

    }, [investmentsKey, isLoadingPrices, prices]);

    const showLoadingState = isLoadingPrices || isLoadingHistory;

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
                    {!showLoadingState && historyData.length > 0 ? (
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
                                        labelFormatter={(label) => format(new Date(label), "PPP")}
                                        indicator="dot"
                                    />}
                                />
                                <Area
                                    dataKey="value"
                                    type="monotone"
                                    fill="url(#fillValue)"
                                    stroke="var(--color-value)"
                                    stackId="a"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : null}
                    {!showLoadingState && historyData.length === 0 && (
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
