'use client';

import { useMemo } from 'react';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Investment, PriceData } from '@/lib/definitions';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

type PortfolioChartProps = {
  investments: Investment[];
  prices: PriceData;
  isLoading: boolean;
  displayCurrency: 'USD' | 'ARS';
  usdToArsRate?: number;
};

const chartConfig = {
  purchaseValue: {
    label: 'Valor de Compra Acumulado',
    color: 'hsl(var(--chart-1))',
  },
  currentValue: {
    label: 'Valor Actual Acumulado',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;


export function PortfolioChart({ investments, prices, isLoading, displayCurrency, usdToArsRate }: PortfolioChartProps) {
  
  const formatCurrency = (amount: number) => {
    if (displayCurrency === 'ARS' && usdToArsRate) {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount * usdToArsRate);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const chartData = useMemo(() => {
    if (!investments || investments.length === 0) return [];
    
    let cumulativePurchase = 0;
    let cumulativeCurrent = 0;
    
    const sortedInvestments = [...investments].sort((a, b) => a.purchaseDate - b.purchaseDate);

    const dataPoints = new Map<number, { date: number; purchaseValue: number; currentValue: number }>();

    sortedInvestments.forEach(inv => {
        const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
        const currentPrice = prices[priceKey]?.price;

        // We only add a point if we have the current price to make the data meaningful
        if (currentPrice !== undefined) {
             const purchaseValue = inv.amount * inv.purchasePrice;
             const currentValue = inv.amount * currentPrice;

             cumulativePurchase += purchaseValue;
             cumulativeCurrent += currentValue;

             dataPoints.set(inv.purchaseDate, {
                 date: inv.purchaseDate,
                 purchaseValue: cumulativePurchase,
                 currentValue: cumulativeCurrent,
             });
        }
    });
    
    if (dataPoints.size === 1) {
        const singlePoint = dataPoints.values().next().value;
        const slightlyEarlierDate = singlePoint.date - (24 * 60 * 60 * 1000); // 1 day before
        return [
            { date: slightlyEarlierDate, purchaseValue: 0, currentValue: 0 },
            singlePoint
        ]
    }

    return Array.from(dataPoints.values());

  }, [investments, prices]);
  
  const showLoadingState = isLoading || (investments.length > 0 && !Object.keys(prices).length);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución del Portafolio ({displayCurrency})</CardTitle>
        <CardDescription>Crecimiento del valor de tus inversiones a lo largo del tiempo.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
            {showLoadingState && (
                 <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}
            {!showLoadingState && chartData.length > 0 ? (
                 <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
                     <defs>
                        <linearGradient id="fillPurchase" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-purchaseValue)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--color-purchaseValue)" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-currentValue)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--color-currentValue)" stopOpacity={0.1}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => format(new Date(value), "MMM yy")}
                        type="number"
                        domain={['dataMin', 'dataMax']}
                    />
                    <YAxis 
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => formatCurrency(Number(value))}
                    />
                    <Tooltip 
                        content={<ChartTooltipContent 
                            formatter={(value) => formatCurrency(value as number)}
                            labelFormatter={(label) => {
                                const date = new Date(Number(label));
                                return date instanceof Date && !isNaN(date.getTime())
                                  ? format(date, "PPP")
                                  : label;
                              }}
                            indicator="dot"
                            />} 
                    />
                    <Legend />
                    <Area type="monotone" dataKey="purchaseValue" stroke="var(--color-purchaseValue)" fill="url(#fillPurchase)" name="Valor de Compra" />
                    <Area type="monotone" dataKey="currentValue" stroke="var(--color-currentValue)" fill="url(#fillCurrent)" name="Valor Actual" />
                </AreaChart>
            ) : null}
            {!showLoadingState && chartData.length === 0 && (
                <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground text-center">
                        Añade tu primera inversión para ver la evolución del portafolio.
                        <br/>
                        Asegúrate de que los precios de los activos se puedan cargar.
                    </p>
                </div>
            )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
