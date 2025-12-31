
"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Investment, PriceData } from "@/lib/definitions";
import { Loader2 } from "lucide-react";

type PortfolioChartProps = {
  investments: Investment[];
  prices: PriceData;
  isLoading: boolean;
};

const chartConfig = {
  purchaseValue: {
    label: "Valor de Compra",
    color: "hsl(var(--chart-1))",
  },
  currentValue: {
    label: "Valor Actual",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function PortfolioChart({ investments, prices, isLoading }: PortfolioChartProps) {
  const chartData = useMemo(() => {
    if (!investments || investments.length === 0) return [];
    
    return investments.map(inv => {
      const purchaseValue = inv.amount * inv.purchasePrice;
      const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
      const currentPrice = prices[priceKey]?.price;
      const currentValue = currentPrice ? inv.amount * currentPrice : 0;

      return {
        name: inv.symbol.toUpperCase(),
        purchaseValue: purchaseValue,
        currentValue: currentValue,
      };
    }).sort((a,b) => b.currentValue - a.currentValue); // Sort by current value
  }, [investments, prices]);

  const showLoadingState = isLoading || (investments.length > 0 && chartData.every(d => d.currentValue === 0 && !isLoading));


  return (
    <Card>
      <CardHeader>
        <CardTitle>Rendimiento del Portafolio</CardTitle>
        <CardDescription>Valor de compra vs. valor actual de cada activo.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
            {showLoadingState && (
                 <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}
            {!showLoadingState && chartData.length > 0 ? (
                 <BarChart data={chartData} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                    />
                    <YAxis 
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        content={<ChartTooltipContent 
                            formatter={(value) => formatCurrency(value as number)}
                            indicator="dot"
                            />} 
                    />
                    <Legend />
                    <Bar dataKey="purchaseValue" fill="var(--color-purchaseValue)" radius={4} />
                    <Bar dataKey="currentValue" fill="var(--color-currentValue)" radius={4} />
                </BarChart>
            ) : null}
            {!showLoadingState && chartData.length === 0 && (
                <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground">Añade una inversión para ver su rendimiento.</p>
                </div>
            )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
