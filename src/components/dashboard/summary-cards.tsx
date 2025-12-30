import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

type SummaryCardsProps = {
  totalIngresos: number;
  totalGastos: number;
  balance: number;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
};

export function SummaryCards({ totalIngresos, totalGastos, balance }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalIngresos)}</div>
          <p className="text-xs text-muted-foreground">En el último mes</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalGastos)}</div>
           <p className="text-xs text-muted-foreground">En el último mes</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Balance</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-accent-foreground' : 'text-destructive'}`}>
            {formatCurrency(balance)}
          </div>
          <p className="text-xs text-muted-foreground">Balance actual</p>
        </CardContent>
      </Card>
    </div>
  );
}
