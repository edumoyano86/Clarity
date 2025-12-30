"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

type ExpensesChartProps = {
  data: {
    name: string;
    total: number;
    icono: string;
  }[];
};

const chartConfig = {
  total: {
    label: "Total",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function ExpensesChart({ data }: ExpensesChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos por Categoría</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer>
                <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    width={100}
                    tick={{ fill: "hsl(var(--foreground))" }}
                />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
