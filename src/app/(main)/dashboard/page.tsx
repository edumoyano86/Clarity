'use client';
import { useEffect, useMemo, useState } from "react";
import { getDashboardData, type Periodo } from "@/lib/actions";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ExpensesChart } from "@/components/dashboard/expenses-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SavingsSuggestions } from "@/components/dashboard/savings-suggestions";
import { Categoria, Appointment } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments";
import { collection, query, where, orderBy, limit } from "firebase/firestore";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState<Periodo>('mes_actual');
  const [isActionLoading, setIsActionLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setIsActionLoading(true);
      setFetchError(null);
      try {
        const dashboardData = await getDashboardData(user.uid, periodo)
        setData(dashboardData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setFetchError("No se pudieron cargar los datos del resumen.");
      } finally {
        setIsActionLoading(false);
      }
    };
    fetchData();
  }, [periodo, user]);

   const upcomingAppointmentsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'appointments'),
      where('date', '>=', new Date().getTime()),
      orderBy('date', 'asc'),
      limit(3)
    );
  }, [firestore, user]);

  const { data: upcomingAppointments, isLoading: loadingAppointments } = useCollection<Appointment>(upcomingAppointmentsQuery);


  const periodos: { key: Periodo, label: string }[] = [
    { key: 'mes_actual', label: 'Este Mes' },
    { key: 'mes_pasado', label: 'Mes Pasado' },
    { key: 'ultimos_3_meses', label: 'Últimos 3 Meses' },
    { key: 'ano_actual', label: 'Este Año' },
  ];

  if (isActionLoading || isUserLoading || !user) {
    return <div className="flex h-full items-center justify-center"><p>Cargando...</p></div>
  }
  
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
      
      {fetchError && <p className="text-destructive">{fetchError}</p>}

      {data ? (
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
            <div className="lg:col-span-1 space-y-8">
              <RecentTransactions transactions={data.transaccionesRecientes} categorias={data.categorias || []} />
              <UpcomingAppointments appointments={upcomingAppointments || []} isLoading={loadingAppointments}/>
            </div>
          </div>
          <SavingsSuggestions userId={user.uid} />
        </>
      ) : (
        !isActionLoading && !fetchError && <p>No hay datos para mostrar en este período.</p>
      )}
    </div>
  );
}
