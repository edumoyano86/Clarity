
"use client";

import { Pie, PieChart, Tooltip, Legend, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { type ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

type ExpensesChartProps = {
  data: {
    name: string;
    total: number;
    icono: string;
    fill: string; // The color now comes from the page
  }[];
};

export function ExpensesChart({ data }: ExpensesChartProps) {
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      total: { label: "Total" },
    };
    if (data) {
      data.forEach((item) => {
        config[item.name] = {
          label: item.name,
          color: item.fill,
        };
      });
    }
    return config;
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos por Categoría</CardTitle>
        <CardDescription>Distribución de tus gastos por categoría para el período seleccionado.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          {data.length > 0 ? (
            <PieChart>
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={<ChartTooltipContent nameKey="name" hideLabel />}
              />
              <Pie
                data={data}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
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
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Legend
                content={({ payload }) => {
                  return (
                    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      {payload?.map((entry, index) => (
                        <li key={`item-${index}`} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span>{entry.value}</span>
                        </li>
                      ))}
                    </ul>
                  )
                }}
              />
            </PieChart>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">No hay gastos para mostrar en este período.</p>
            </div>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
