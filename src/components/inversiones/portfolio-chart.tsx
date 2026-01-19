'use client';

import React from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { PortfolioDataPoint } from '@/lib/definitions';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { PortfolioPeriod } from '@/app/(main)/inversiones/page';


interface PortfolioChartProps {
    chartData: PortfolioDataPoint[];
    totalValue: number;
    isLoading: boolean;
    period: PortfolioPeriod;
    setPeriod: (period: PortfolioPeriod) => void;
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

export function PortfolioChart({ chartData, totalValue, isLoading, period, setPeriod }: PortfolioChartProps) {
    
    const hasData = chartData.length > 0 && chartData.some(d => d.value !== null && d.value > 0);
    const periodOptions: { label: string; value: PortfolioPeriod }[] = [
        { label: '7D', value: 7 },
        { label: '30D', value: 30 },
        { label: '90D', value: 90 },
    ];
    
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardTitle>Evolución del Portafolio</CardTitle>
                        <CardDescription>
                            Valor total del portafolio. Valor actual: {formatCurrency(totalValue)}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                         {periodOptions.map(p => (
                            <Button
                                key={p.value}
                                variant={period === p.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPeriod(p.value)}
                                disabled={isLoading}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                    {isLoading && (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {!isLoading && hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 10 }}>
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
                                    minTickGap={30}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => formatCurrency(value as number)}
                                    width={80}
                                />
                                <Tooltip
                                    content={<ChartTooltipContent
                                        formatter={(value) => formatCurrency(value as number)}
                                        labelFormatter={(label) => {
                                            if (!label) return '';
                                            const date = new Date(Number(label));
                                            if (isNaN(date.getTime())) return '';
                                            return format(date, "PPP");
                                        }}
                                        indicator="dot"
                                    />}
                                />
                                <Area
                                    connectNulls
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
                    {!isLoading && !hasData && (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-muted-foreground text-center">
                                No hay suficientes datos históricos para mostrar el gráfico.
                            </p>
                        </div>
                    )}
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
