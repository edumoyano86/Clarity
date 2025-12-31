'use client';
import { useMemo, useState } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ExpensesChart } from "@/components/dashboard/expenses-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SavingsSuggestions } from "@/components/dashboard/savings-suggestions";
import { Categoria, Appointment, Transaction, Investment } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { InvestmentsChart } from "@/components/dashboard/investments-chart";
import { BalanceChart } from "@/components/dashboard/balance-chart";

type Periodo = 'mes_actual' | 'mes_pasado' | 'ultimos_3_meses' | 'ano_actual';

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [periodo, setPeriodo] = useState<Periodo>('mes_actual');

  const transactionsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'transactions');
  }, [firestore, user]);
  const { data: transactions, isLoading: loadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const categoriesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'expenseCategories');
  }, [firestore, user]);
  const { data: categorias, isLoading: loadingCategorias } = useCollection<Categoria>(categoriesQuery);

   const investmentsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'investments'), orderBy('purchaseDate', 'asc'));
  }, [firestore, user]);
  const { data: investments, isLoading: loadingInvestments } = useCollection<Investment>(investmentsQuery);

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

  const dashboardData = useMemo(() => {
    if (!transactions || !categorias) return null;

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (periodo) {
      case 'mes_actual':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'mes_pasado':
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case 'ultimos_3_meses':
        startDate = startOfMonth(subMonths(now, 2));
        endDate = endOfMonth(now);
        break;
      case 'ano_actual':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    const filterByDate = (item: { date: number }) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    };

    const transactionsFiltradas = transactions.filter(filterByDate);

    const ingresos = transactionsFiltradas.filter(t => t.type === 'ingreso');
    const gastosYPagos = transactionsFiltradas.filter(t => t.type === 'gasto' || t.type === 'pago');

    const totalIngresos = ingresos.reduce((sum, i) => sum + i.amount, 0);
    const totalGastos = gastosYPagos.reduce((sum, g) => sum + g.amount, 0);

    const gastosPorCategoria = categorias.map(cat => {
      // We only consider 'gasto' type for the category chart, not 'pago'
      const gastosEnCategoria = transactionsFiltradas.filter(g => g.type === 'gasto' && g.categoryId === cat.id);
      const total = gastosEnCategoria.reduce((sum, g) => sum + g.amount, 0);
      return {
        name: cat.name,
        total,
        icono: cat.icono,
      };
    }).filter(c => c.total > 0);

    const transaccionesRecientes = [...transactions]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5);

    return {
      totalIngresos,
      totalGastos,
      balance: totalIngresos - totalGastos,
      gastosPorCategoria,
      transaccionesRecientes,
      categorias,
    };
  }, [periodo, transactions, categorias]);

  const periodos: { key: Periodo, label: string }[] = [
    { key: 'mes_actual', label: 'Este Mes' },
    { key: 'mes_pasado', label: 'Mes Pasado' },
    { key: 'ultimos_3_meses', label: 'Últimos 3 Meses' },
    { key: 'ano_actual', label: 'Este Año' },
  ];

  const isLoading = isUserLoading || loadingTransactions || loadingCategorias || loadingInvestments;

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><p>Cargando...</p></div>
  }
  
  if (!user) {
     return <div className="flex h-full items-center justify-center"><p>Usuario no encontrado.</p></div>
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
      
      {dashboardData ? (
        <>
          <SummaryCards
            totalIngresos={dashboardData.totalIngresos}
            totalGastos={dashboardData.totalGastos}
            balance={dashboardData.balance}
            periodo={periodo}
          />
          <div className="grid gap-8 md:grid-cols-2">
            <InvestmentsChart data={investments || []} />
            <BalanceChart ingresos={dashboardData.totalIngresos} gastos={dashboardData.totalGastos} />
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ExpensesChart data={dashboardData.gastosPorCategoria} />
            </div>
            <div className="lg:col-span-1 space-y-8">
              <RecentTransactions transactions={dashboardData.transaccionesRecientes} categorias={dashboardData.categorias || []} />
              <UpcomingAppointments appointments={upcomingAppointments || []} isLoading={loadingAppointments}/>
            </div>
          </div>
          <SavingsSuggestions userId={user.uid} />
        </>
      ) : (
        !isLoading && <p>No hay datos para mostrar en este período.</p>
      )}
    </div>
  );
}
