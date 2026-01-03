'use client';

import { Pie, PieChart, Tooltip, Legend, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Investment, PriceData } from '@/lib/definitions';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

interface PortfolioChartProps {
    investments: Investment[];
    prices: PriceData;
    isLoading: boolean;
};

const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function PortfolioChart({ investments, prices, isLoading }: PortfolioChartProps) {
  
  const { chartData, chartConfig, totalValue } = useMemo(() => {
    if (!investments || investments.length === 0 || isLoading) {
      return { chartData: [], chartConfig: {}, totalValue: 0 };
    }

    const data = investments.map((inv, index) => {
        const priceKey = inv.assetType === 'crypto' ? inv.assetId : inv.symbol;
        const currentPrice = prices[priceKey]?.price || 0;
        const value = inv.amount * currentPrice;
        return {
            name: inv.name,
            value: value,
            fill: CHART_COLORS[index % CHART_COLORS.length]
        };
    }).filter(item => item.value > 0.01); // Filter out assets with negligible value

    const total = data.reduce((acc, item) => acc + item.value, 0);

    const config: ChartConfig = {
        value: {
            label: 'Valor (USD)',
        },
    };
    data.forEach(item => {
        config[item.name] = {
            label: item.name,
            color: item.fill,
        };
    });

    return { chartData: data, chartConfig: config, totalValue: total };

  }, [investments, prices, isLoading]);
  
  const showLoadingState = isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Composición del Portafolio</CardTitle>
        <CardDescription>
            Distribución de tus activos. Valor total: {formatCurrency(totalValue)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
            {showLoadingState && (
                 <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}
            {!showLoadingState && chartData.length > 0 ? (
                 <PieChart>
                    <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        content={<ChartTooltipContent 
                            formatter={(value, name) => [formatCurrency(value as number), name]}
                            nameKey="name" 
                            hideLabel 
                        />}
                    />
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        labelLine={false}
                        label={({
                            cx,
                            cy,
                            midAngle,
                            innerRadius,
                            outerRadius,
                            percent,
                        }) => {
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                            const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

                            if (percent < 0.05) return null; // Don't render label for small slices

                            return (
                                <text
                                x={x}
                                y={y}
                                fill="white"
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="text-xs font-bold"
                                >
                                {`${(percent * 100).toFixed(0)}%`}
                                </text>
                            );
                        }}
                    >
                        {chartData.map((entry) => (
                            <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                        ))}
                    </Pie>
                    <Legend />
                </PieChart>
            ) : null}
            {!showLoadingState && chartData.length === 0 && (
                <div className="flex h-full items-center justify-center">
                    <p className="text-muted-foreground text-center">
                        Añade tu primera inversión para ver la composición del portafolio.
                    </p>
                </div>
            )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}