
"use client";

import { Investment } from "@/lib/definitions";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { format } from "date-fns";
import { type ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

type InvestmentsChartProps = {
  data: Investment[];
};

const chartConfig = {
  value: {
    label: "Valor",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};


export function InvestmentsChart({ data }: InvestmentsChartProps) {
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];
        let cumulativeValue = 0;
        return data
            .sort((a, b) => a.purchaseDate - b.purchaseDate)
            .map(investment => {
                cumulativeValue += investment.purchasePrice * investment.amount;
                return {
                    date: investment.purchaseDate,
                    value: cumulativeValue,
                };
            });
    }, [data]);
    
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución del Portafolio</CardTitle>
        <CardDescription>Valor de compra acumulado de tus inversiones a lo largo del tiempo.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
            {chartData.length > 0 ? (
                 <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
                    <defs>
                        <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="5%"
                            stopColor="var(--color-value)"
                            stopOpacity={0.8}
                        />
                        <stop
                            offset="95%"
                            stopColor="var(--color-value)"
                            stopOpacity={0.1}
                        />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => format(new Date(value), "MMM yy")}
                    />
                    <YAxis 
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => formatCurrency(value)}
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
                        type="natural"
                        fill="url(#fillValue)"
                        stroke="var(--color-value)"
                        stackId="a"
                    />
                </AreaChart>
            ) : (
                <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">No hay datos de inversión para mostrar.</p>
                </div>
            )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
