import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Periodo } from "@/lib/actions";

type SummaryCardsProps = {
  totalIngresos: number;
  totalGastos: number;
  balance: number;
  periodo: Periodo;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

const getPeriodoLabel = (periodo: Periodo) => {
    switch (periodo) {
        case 'mes_actual': return 'En este mes';
        case 'mes_pasado': return 'En el mes pasado';
        case 'ultimos_3_meses': return 'En los últimos 3 meses';
        case 'ano_actual': return 'En este año';
        default: return 'En el período';
    }
}

export function SummaryCards({ totalIngresos, totalGastos, balance, periodo }: SummaryCardsProps) {
  const periodoLabel = getPeriodoLabel(periodo);
  
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalIngresos)}</div>
          <p className="text-xs text-muted-foreground">{periodoLabel}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalGastos)}</div>
           <p className="text-xs text-muted-foreground">{periodoLabel}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Balance</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
            {formatCurrency(balance)}
          </div>
          <p className="text-xs text-muted-foreground">Balance del período</p>
        </CardContent>
      </Card>
    </div>
  );
}
