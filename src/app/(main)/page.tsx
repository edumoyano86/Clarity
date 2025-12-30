import { getCategorias, getDashboardData } from "@/lib/actions";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ExpensesChart } from "@/components/dashboard/expenses-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SavingsSuggestions } from "@/components/dashboard/savings-suggestions";

export default async function DashboardPage() {
  const { totalIngresos, totalGastos, balance, gastosPorCategoria, transaccionesRecientes } = await getDashboardData();
  const categorias = await getCategorias();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold font-headline">Resumen Financiero</h1>
      <SummaryCards
        totalIngresos={totalIngresos}
        totalGastos={totalGastos}
        balance={balance}
      />
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <ExpensesChart data={gastosPorCategoria} />
        </div>
        <div className="lg:col-span-1">
          <RecentTransactions transactions={transaccionesRecientes} categorias={categorias} />
        </div>
      </div>
      <SavingsSuggestions />
    </div>
  );
}
