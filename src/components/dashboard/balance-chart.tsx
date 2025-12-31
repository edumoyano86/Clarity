
"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

type BalanceChartProps = {
  ingresos: number;
  gastos: number;
};

const chartConfig = {
  ingresos: {
    label: "Ingresos",
    color: "hsl(var(--chart-2))",
  },
  gastos: {
    label: "Gastos",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig;

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

export function BalanceChart({ ingresos, gastos }: BalanceChartProps) {
    const chartData = [
        { name: "Ingresos", value: ingresos, fill: "var(--color-ingresos)" },
        { name: "Gastos", value: gastos, fill: "var(--color-gastos)" },
    ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance del Período</CardTitle>
        <CardDescription>Ingresos vs. Gastos totales para el período seleccionado.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={chartData} layout="horizontal" margin={{ left: 10, right: 30 }}>
                <YAxis 
                    dataKey="name" 
                    type="category" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <XAxis 
                    dataKey="value" 
                    type="number" 
                    hide 
                />
                <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted))' }} 
                    content={<ChartTooltipContent 
                        formatter={(value) => formatCurrency(value as number)}
                        hideLabel
                    />} 
                />
                 <Bar dataKey="value" name="Valor" radius={4} />
            </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
