
'use client';
import { useEffect, useState } from "react";
import { getCategorias, getDashboardData, type Periodo } from "@/lib/actions";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ExpensesChart } from "@/components/dashboard/expenses-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SavingsSuggestions } from "@/components/dashboard/savings-suggestions";
import { Categoria } from "@/lib/definitions";
import { Button } from "@/components/ui/button";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>('mes_actual');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [dashboardData, categoriasData] = await Promise.all([
        getDashboardData(periodo),
        getCategorias()
      ]);
      setData(dashboardData);
      setCategorias(categoriasData);
      setIsLoading(false);
    };
    fetchData();
  }, [periodo]);

  const periodos: { key: Periodo, label: string }[] = [
    { key: 'mes_actual', label: 'Este Mes' },
    { key: 'mes_pasado', label: 'Mes Pasado' },
    { key: 'ultimos_3_meses', label: 'Últimos 3 Meses' },
    { key: 'ano_actual', label: 'Este Año' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold font-headline">Resumen Financiero</h1>
        <div className="flex items-center gap-2">
            {periodos.map(p => (
                <Button
                    key={p.key}
                    variant={periodo === p.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriodo(p.key)}
                >
                    {p.label}
                </Button>
            ))}
        </div>
      </div>
      
      {isLoading ? (
        <p>Cargando datos...</p>
      ) : data ? (
        <>
          <SummaryCards
            totalIngresos={data.totalIngresos}
            totalGastos={data.totalGastos}
            balance={data.balance}
            periodo={periodo}
          />
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ExpensesChart data={data.gastosPorCategoria} />
            </div>
            <div className="lg:col-span-1">
              <RecentTransactions transactions={data.transaccionesRecientes} categorias={categorias} />
            </div>
          </div>
          <SavingsSuggestions />
        </>
      ) : (
        <p>No se pudieron cargar los datos.</p>
      )}
    </div>
  );
}
