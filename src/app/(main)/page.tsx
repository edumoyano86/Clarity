'use client';
import { useMemo, useState } from "react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ExpensesChart } from "@/components/dashboard/expenses-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SavingsSuggestions } from "@/components/dashboard/savings-suggestions";
import { Categoria, Appointment, Transaction, Investment, Account } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { UpcomingAppointments } from "@/components/dashboard/upcoming-appointments";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfToday } from 'date-fns';
import { PortfolioChart } from "@/components/inversiones/portfolio-chart";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { BudgetAlerts, type BudgetAlert } from "@/components/dashboard/budget-alerts";
import { SavingsGoals } from "@/components/dashboard/savings-goals";
import { QuickStart } from "@/components/onboarding/quick-start";
import { useDashboardPortfolio, type PortfolioPeriod } from "@/hooks/use-dashboard-portfolio";

type Periodo = 'mes_actual' | 'mes_pasado' | 'ultimos_3_meses' | 'ano_actual';

const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [periodo, setPeriodo] = useState<Periodo>('mes_actual');
  const [portfolioPeriod, setPortfolioPeriod] = useState<PortfolioPeriod>(90);


  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'transactions');
  }, [firestore, user]);
  const { data: transactions, isLoading: loadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'expenseCategories');
  }, [firestore, user]);
  const { data: categorias, isLoading: loadingCategorias } = useCollection<Categoria>(categoriesQuery);

   const investmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'investments'), orderBy('purchaseDate', 'asc'));
  }, [firestore, user]);
  const { data: investments, isLoading: loadingInvestments } = useCollection<Investment>(investmentsQuery);
  const { chartData, totalValue, isLoading: isLoadingHistory } = useDashboardPortfolio(investments, portfolioPeriod);


  const accountsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'accounts'), where('status', '==', 'pendiente'));
  }, [firestore, user]);
  const { data: accounts, isLoading: loadingAccounts } = useCollection<Account>(accountsQuery);

  const upcomingAppointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const todayTimestamp = startOfToday().getTime();
    return query(
      collection(firestore, 'users', user.uid, 'appointments'),
      where('date', '>=', todayTimestamp),
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

    // Balance Total Histórico (sin filtrar por fecha)
    const allTimeIngresos = transactions.filter(t => t.type === 'ingreso').reduce((sum, i) => sum + i.amount, 0);
    const allTimeGastosYPagos = transactions.filter(t => t.type === 'gasto' || t.type === 'pago').reduce((sum, g) => sum + g.amount, 0);
    const balanceTotalLiquido = allTimeIngresos - allTimeGastosYPagos;

    const ingresos = transactionsFiltradas.filter(t => t.type === 'ingreso');
    const gastosYPagos = transactionsFiltradas.filter(t => t.type === 'gasto' || t.type === 'pago');

    const totalIngresos = ingresos.reduce((sum, i) => sum + i.amount, 0);
    const totalGastos = gastosYPagos.reduce((sum, g) => sum + g.amount, 0);

    let colorIndex = 0;
    
    // Gastos categorizados
    const gastosPorCategoriaData = categorias.map(cat => {
        const gastosEnCategoria = transactionsFiltradas.filter(g => g.type === 'gasto' && g.categoryId === cat.id);
        const total = gastosEnCategoria.reduce((sum, g) => sum + g.amount, 0);
        return {
          name: cat.name,
          total: total,
          icono: cat.icono,
        };
    });

    // Pagos (considerados como una categoría aparte para el gráfico)
    const totalPagos = transactionsFiltradas
        .filter(t => t.type === 'pago')
        .reduce((sum, p) => sum + p.amount, 0);

    if (totalPagos > 0) {
        gastosPorCategoriaData.push({
            name: 'Pago de Cuentas',
            total: totalPagos,
            icono: 'Wallet' // O un icono genérico que tengas
        });
    }

    const gastosPorCategoria = gastosPorCategoriaData
        .filter(c => c.total > 0)
        .map(c => {
          const result = {
            ...c,
            fill: CHART_COLORS[colorIndex % CHART_COLORS.length]
          };
          colorIndex++;
          return result;
        });

    // Gastos por Concepto (Top 10)
    let colorIndexConcepto = 0;
    const gastosAgrupadosPorConcepto: Record<string, number> = {};
    
    gastosYPagos.forEach(g => {
        // Agrupamos usando la descripción o un valor por defecto para pagos sin descripción
        const desc = g.description || (g.type === 'pago' ? 'Pago de Cuenta' : 'Sin descripción');
        gastosAgrupadosPorConcepto[desc] = (gastosAgrupadosPorConcepto[desc] || 0) + g.amount;
    });

    const gastosPorConcepto = Object.entries(gastosAgrupadosPorConcepto)
        .filter(([_, total]) => total > 0)
        .sort((a, b) => b[1] - a[1]) // Mayor a menor
        .slice(0, 10) // Top 10
        .map(([name, total]) => {
             const result = {
                name,
                total,
                icono: 'Receipt',
                fill: CHART_COLORS[colorIndexConcepto % CHART_COLORS.length]
             };
             colorIndexConcepto++;
             return result;
        });

    const transaccionesRecientes = [...transactions]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5);

    const totalCuentasPorPagar = (accounts || []).reduce((sum, acc) => sum + (acc.amount - acc.paidAmount), 0);

    const budgetAlerts = (categorias || [])
      .map((categoria) => {
        const budget = Number(categoria.budget || 0);
        if (!budget) return null;
        const spent = transactionsFiltradas
          .filter((g) => g.type === 'gasto' && g.categoryId === categoria.id)
          .reduce((sum, g) => sum + g.amount, 0);
        const percentage = Math.min(100, (spent / budget) * 100);
        const remaining = budget - spent;
        if (spent <= 0) return null;
        return {
          categoryName: categoria.name,
          spent,
          budget,
          percentage,
          status: percentage >= 100 ? 'danger' : percentage >= 80 ? 'warning' : 'warning',
          remaining,
        } satisfies BudgetAlert;
      })
      .filter((item): item is BudgetAlert => Boolean(item))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 4);

    return {
      totalIngresos,
      totalGastos,
      balance: balanceTotalLiquido,
      gastosPorCategoria,
      gastosPorConcepto,
      transaccionesRecientes,
      categorias,
      totalCuentasPorPagar,
      budgetAlerts,
    };
  }, [periodo, transactions, categorias, accounts]);

  const periodos: { key: Periodo, label: string }[] = [
    { key: 'mes_actual', label: 'Este Mes' },
    { key: 'mes_pasado', label: 'Mes Pasado' },
    { key: 'ultimos_3_meses', label: 'Últimos 3 Meses' },
    { key: 'ano_actual', label: 'Este Año' },
  ];

  const isLoading = isUserLoading || loadingTransactions || loadingCategorias || loadingInvestments || loadingAccounts;

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><p>Cargando...</p></div>
  }
  
  if (!user) {
     return <div className="flex h-full items-center justify-center"><p>Usuario no encontrado.</p></div>
  }

    const portfolioPeriodOptions: { label: string; value: PortfolioPeriod }[] = [
        { label: '7D', value: 7 },
        { label: '30D', value: 30 },
        { label: '90D', value: 90 },
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
      
      {dashboardData ? (
        <>
          <QuickStart />
          <SummaryCards
            totalIngresos={dashboardData.totalIngresos}
            totalGastos={dashboardData.totalGastos}
            balance={dashboardData.balance}
            cuentasPorPagar={dashboardData.totalCuentasPorPagar}
            periodoLabel={getPeriodoLabel(periodo)}
          />
          <div className="grid gap-8 md:grid-cols-2">
            <PortfolioChart 
              chartData={chartData} 
              totalValue={totalValue} 
              isLoading={isLoadingHistory}
              period={portfolioPeriod}
              setPeriod={setPortfolioPeriod}
            />
            <BalanceChart ingresos={dashboardData.totalIngresos} gastos={dashboardData.totalGastos} />
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <ExpensesChart 
                data={dashboardData.gastosPorCategoria} 
                title="Por Categoría" 
                description="Agrupado por etiquetas."
              />
            </div>
            <div className="lg:col-span-1">
              <ExpensesChart 
                data={dashboardData.gastosPorConcepto} 
                title="Top 10 Gastos" 
                description="Tus mayores gastos individuales."
              />
            </div>
            <div className="lg:col-span-1 space-y-8">
              <BudgetAlerts alerts={dashboardData.budgetAlerts || []} />
              <SavingsGoals />
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

const getPeriodoLabel = (periodo: Periodo) => {
    switch (periodo) {
        case 'mes_actual': return 'En este mes';
        case 'mes_pasado': return 'En el mes pasado';
        case 'ultimos_3_meses': return 'En los últimos 3 meses';
        case 'ano_actual': return 'En este año';
        default: return 'En el período';
    }
}
