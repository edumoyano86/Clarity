'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Investment, PriceData } from '@/lib/definitions';
import { Loader2 } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

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

// Helper to introduce a delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
            
            const results = [];
            if (cryptoIds.length > 0) {
                for (const id of cryptoIds) {
                    try {
                        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${startDate.getTime() / 1000}&to=${endDate.getTime() / 1000}`);
                        if (!response.ok) {
                            console.warn(`Failed to fetch history for ${id}: ${response.statusText}`);
                            results.push({ id, prices: null });
                        } else {
                            const data = await response.json();
                            results.push({ id, prices: data.prices });
                        }
                    } catch (error) {
                        console.error(`Error fetching history for ${id}:`, error);
                        results.push({ id, prices: null });
                    }
                    await sleep(300); // Wait 300ms between calls to avoid rate limiting
                }
            }

            try {
                const priceHistory: { [id: string]: { [date: string]: number } } = {};
                
                results.forEach(result => {
                    if (result && result.prices) {
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
                        if (inv.purchaseDate > currentDate.getTime()) return;

                        if (inv.assetType === 'crypto') {
                            let historicalPrice: number | undefined;
                            for (let i = 0; i <= 5; i++) {
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
                        } else { 
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
                
                if (timeline.length === 1) {
                     timeline.unshift({ date: subDays(new Date(timeline[0].date), 1).getTime(), value: 0 });
                }
                setHistoryData(timeline);

            } catch (error) {
                console.error("Error processing portfolio history:", error);
                setHistoryData([]);
            } finally {
                setIsLoadingHistory(false);
            }
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
