
"use client";

import { Bar, BarChart, XAxis, YAxis, Tooltip, Cell } from "recharts";
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
        { name: "Ingresos", value: ingresos, fill: "hsl(var(--chart-2))" },
        { name: "Gastos", value: gastos, fill: "hsl(var(--destructive))" },
    ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance del Período</CardTitle>
        <CardDescription>Ingresos vs. Gastos totales para el período seleccionado.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }} width={399} height={300}>
                  <YAxis 
                      dataKey="name" 
                      type="category" 
                      tickLine={false} 
                      axisLine={false}
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 12 }}
                      width={80}
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
                  <Bar dataKey="value" name="Valor" radius={4} barSize={35}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
              </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
