'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Transaction, Categoria, Investment, WishlistItem } from '@/lib/definitions';
import {
  PieChart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Receipt,
  PiggyBank,
} from 'lucide-react';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount);

interface Rule503020Props {
  totalIngresos: number;
  transactions: Transaction[];
  categorias: Categoria[];
  investments?: Investment[];
  wishlistItems?: WishlistItem[];
  periodoLabel?: string;
  startDate?: Date;
  endDate?: Date;
}

// Helper to identify if an expense concept or category is an essential need
const isNecessityCategory = (categoryName = '', description = '') => {
  const text = `${categoryName} ${description}`.toLowerCase();
  const necessityKeywords = [
    'alquiler',
    'vivienda',
    'hogar',
    'casa',
    'expensas',
    'supermercado',
    'alimento',
    'comida',
    'mercado',
    'almacen',
    'verduleria',
    'carniceria',
    'servicio',
    'luz',
    'gas',
    'agua',
    'internet',
    'telefono',
    'telefonia',
    'celular',
    'wifi',
    'salud',
    'medico',
    'farmacia',
    'remedio',
    'medicina',
    'obra social',
    'prepaga',
    'dentista',
    'educacion',
    'colegio',
    'universidad',
    'facultad',
    'cuota',
    'transporte',
    'sube',
    'colectivo',
    'nafta',
    'combustible',
    'peaje',
    'patente',
    'seguro',
    'impuesto',
    'afip',
    'rentas',
    'tributo',
  ];
  return necessityKeywords.some((kw) => text.includes(kw));
};

export function Rule503020({
  totalIngresos,
  transactions = [],
  categorias = [],
  investments = [],
  wishlistItems = [],
  periodoLabel = 'En este período',
  startDate,
  endDate,
}: Rule503020Props) {
  const [showDetails, setShowDetails] = useState(false);

  const metrics = useMemo(() => {
    const categoryMap = new Map<string, string>();
    categorias.forEach((c) => categoryMap.set(c.id, c.name));

    // 1. Debt payments (All 'pago' transactions count towards 50% Necesidades / Deudas)
    const debtPayments = transactions.filter((t) => t.type === 'pago');
    const debtPaymentsAmount = debtPayments.reduce((sum, t) => sum + t.amount, 0);

    // 2. Expenses breakdown (Necesidades vs Deseos)
    const expenseTransactions = transactions.filter((t) => t.type === 'gasto');
    let essentialExpensesAmount = 0;
    let lifestyleExpensesAmount = 0;
    let wishlistExpensesAmount = 0;

    const essentialItemsList: { name: string; amount: number }[] = [];
    const lifestyleItemsList: { name: string; amount: number }[] = [];

    expenseTransactions.forEach((t) => {
      const catName = (t.categoryId && categoryMap.get(t.categoryId)) || '';
      const desc = t.description || '';
      const isWishlistPurchase = desc.toLowerCase().includes('compra cumplida');

      if (isWishlistPurchase) {
        wishlistExpensesAmount += t.amount;
        lifestyleExpensesAmount += t.amount;
        lifestyleItemsList.push({ name: desc, amount: t.amount });
      } else if (isNecessityCategory(catName, desc)) {
        essentialExpensesAmount += t.amount;
        essentialItemsList.push({ name: desc || catName, amount: t.amount });
      } else {
        lifestyleExpensesAmount += t.amount;
        lifestyleItemsList.push({ name: desc || catName || 'Ocio / Consumo', amount: t.amount });
      }
    });

    // 3. Investments purchased in period
    let investmentsPurchasedAmount = 0;
    if (startDate && endDate) {
      investments.forEach((inv) => {
        if (inv.purchaseDate >= startDate.getTime() && inv.purchaseDate <= endDate.getTime()) {
          const price = inv.purchasePrice || 0;
          investmentsPurchasedAmount += price * inv.amount;
        }
      });
    }

    // 4. Monthly Net Savings (Income - Expenses & Payments)
    const totalExpensesAndPayments = essentialExpensesAmount + lifestyleExpensesAmount + debtPaymentsAmount;
    const monthlyNetSavings = Math.max(0, totalIngresos - totalExpensesAndPayments);
    const totalSavingsAndInvestments = monthlyNetSavings + investmentsPurchasedAmount;

    // Totals for the 3 pillars
    const necesidadesActual = essentialExpensesAmount + debtPaymentsAmount;
    const deseosActual = lifestyleExpensesAmount;
    const ahorroActual = totalSavingsAndInvestments;

    // Targets (50 / 30 / 20)
    const baseIncome = Math.max(totalIngresos, 1);
    const necesidadesTarget = totalIngresos * 0.5;
    const deseosTarget = totalIngresos * 0.3;
    const ahorroTarget = totalIngresos * 0.2;

    const necesidadesPercent = (necesidadesActual / baseIncome) * 100;
    const deseosPercent = (deseosActual / baseIncome) * 100;
    const ahorroPercent = (ahorroActual / baseIncome) * 100;

    // Statuses
    const necesidadesStatus: 'success' | 'warning' | 'danger' =
      necesidadesPercent <= 50 ? 'success' : necesidadesPercent <= 60 ? 'warning' : 'danger';

    const deseosStatus: 'success' | 'warning' | 'danger' =
      deseosPercent <= 30 ? 'success' : deseosPercent <= 40 ? 'warning' : 'danger';

    const ahorroStatus: 'success' | 'warning' | 'danger' =
      ahorroPercent >= 20 ? 'success' : ahorroPercent >= 10 ? 'warning' : 'danger';

    // Overall Health Assessment
    let healthScore: 'excelente' | 'bueno' | 'ajuste_requerido' = 'bueno';
    let summaryAdvice = '';

    if (necesidadesStatus === 'success' && deseosStatus === 'success' && ahorroStatus === 'success') {
      healthScore = 'excelente';
      summaryAdvice =
        '¡Felicitaciones! Tu presupuesto respeta la regla 50/30/20 con equilibrio perfecto entre necesidades, disfrute y ahorro.';
    } else if (necesidadesStatus === 'danger') {
      healthScore = 'ajuste_requerido';
      summaryAdvice =
        'Tus gastos fijos y deudas superan el 50% de tus ingresos. Enfócate en liquidar deudas de mayor tasa y revisar suscripciones fijas.';
    } else if (deseosStatus === 'danger') {
      healthScore = 'ajuste_requerido';
      summaryAdvice =
        'Tus compras personales y ocio superan el 30%. Te recomendamos revisar tu Lista de Deseos y pausar consumos no urgentes.';
    } else if (ahorroStatus === 'danger') {
      healthScore = 'bueno';
      summaryAdvice =
        'Tu ahorro del período está por debajo del 20%. Reduciendo ligeramente consumos prescindibles podrás acercarte a tu meta de ahorro.';
    } else {
      healthScore = 'bueno';
      summaryAdvice =
        'Tus finanzas van por buen camino. Pequeños ajustes en gastos variables te permitirán alcanzar el 20% de ahorro ideal.';
    }

    return {
      necesidadesTarget,
      necesidadesActual,
      necesidadesPercent,
      necesidadesStatus,
      debtPaymentsAmount,
      essentialExpensesAmount,

      deseosTarget,
      deseosActual,
      deseosPercent,
      deseosStatus,
      lifestyleExpensesAmount,
      wishlistExpensesAmount,

      ahorroTarget,
      ahorroActual,
      ahorroPercent,
      ahorroStatus,
      monthlyNetSavings,
      investmentsPurchasedAmount,

      healthScore,
      summaryAdvice,
      essentialItemsCount: essentialItemsList.length,
      lifestyleItemsCount: lifestyleItemsList.length,
    };
  }, [totalIngresos, transactions, categorias, investments, startDate, endDate]);

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <PieChart className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Regla Financiera 50 / 30 / 20</CardTitle>
              {metrics.healthScore === 'excelente' ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                  Excelente
                </Badge>
              ) : metrics.healthScore === 'bueno' ? (
                <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                  Equilibrado
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  Requiere Ajuste
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              Compara tus ingresos {periodoLabel.toLowerCase()} contra el estándar financiero ideal: 50% Necesidades y Deudas, 30% Deseos y 20% Ahorro.
            </CardDescription>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-muted-foreground uppercase tracking-wider block font-semibold">
              Ingresos Base ({periodoLabel})
            </span>
            <span className="text-xl font-bold text-foreground">
              {formatCurrency(totalIngresos)}
            </span>
          </div>
        </div>

        {/* Multi-segment Visual Distribution Bar */}
        <div className="space-y-1.5 pt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Distribución de tus Ingresos</span>
            <span>
              Total ejecutado:{' '}
              <strong className="text-foreground">
                {(metrics.necesidadesPercent + metrics.deseosPercent).toFixed(0)}% en gastos y deudas
              </strong>
            </span>
          </div>

          <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
            {/* Necesidades (50%) Segment */}
            <div
              style={{ width: `${Math.min(100, metrics.necesidadesPercent)}%` }}
              className={`h-full transition-all duration-500 ${
                metrics.necesidadesStatus === 'danger'
                  ? 'bg-rose-500'
                  : metrics.necesidadesStatus === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-sky-500'
              }`}
              title={`Necesidades: ${metrics.necesidadesPercent.toFixed(1)}%`}
            />

            {/* Deseos (30%) Segment */}
            <div
              style={{ width: `${Math.min(100 - metrics.necesidadesPercent, metrics.deseosPercent)}%` }}
              className={`h-full transition-all duration-500 ${
                metrics.deseosStatus === 'danger'
                  ? 'bg-orange-500'
                  : 'bg-violet-500'
              }`}
              title={`Deseos: ${metrics.deseosPercent.toFixed(1)}%`}
            />

            {/* Ahorro (20%) Segment */}
            <div
              style={{
                width: `${Math.min(
                  Math.max(0, 100 - (metrics.necesidadesPercent + metrics.deseosPercent)),
                  metrics.ahorroPercent
                )}%`,
              }}
              className="h-full bg-emerald-500 transition-all duration-500"
              title={`Ahorro e Inversión: ${metrics.ahorroPercent.toFixed(1)}%`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              Necesidades & Deudas (Meta ≤ 50%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
              Deseos & Consumo (Meta ≤ 30%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Ahorro & Inversión (Meta ≥ 20%)
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {/* 3 Columns: 50% / 30% / 20% Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* 50% NECESIDADES Y DEUDAS */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              metrics.necesidadesStatus === 'danger'
                ? 'bg-rose-500/5 border-rose-500/30'
                : 'bg-card border-border hover:border-sky-500/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-sky-500" />
                <h4 className="font-semibold text-sm">50% Necesidades & Deudas</h4>
              </div>
              <Badge
                variant={metrics.necesidadesStatus === 'danger' ? 'destructive' : 'outline'}
                className="text-[11px]"
              >
                {metrics.necesidadesPercent.toFixed(0)}%
              </Badge>
            </div>

            <div className="space-y-1 my-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">
                  {formatCurrency(metrics.necesidadesActual)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Meta: {formatCurrency(metrics.necesidadesTarget)}
                </span>
              </div>
              <Progress
                value={Math.min(100, (metrics.necesidadesPercent / 50) * 100)}
                className={`h-2 ${
                  metrics.necesidadesStatus === 'danger' ? '[&>div]:bg-rose-500' : '[&>div]:bg-sky-500'
                }`}
              />
            </div>

            <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t mt-3">
              <div className="flex justify-between">
                <span>Pagos de Cuentas / Deudas:</span>
                <strong className="text-foreground">{formatCurrency(metrics.debtPaymentsAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Gastos Esenciales (Hogar, Salud, etc.):</span>
                <strong className="text-foreground">
                  {formatCurrency(metrics.essentialExpensesAmount)}
                </strong>
              </div>
              <div className="flex justify-between pt-1 font-medium">
                <span>Diferencia con el 50%:</span>
                <span
                  className={
                    metrics.necesidadesActual <= metrics.necesidadesTarget
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400 font-bold'
                  }
                >
                  {metrics.necesidadesActual <= metrics.necesidadesTarget
                    ? `${formatCurrency(metrics.necesidadesTarget - metrics.necesidadesActual)} disponible`
                    : `+${formatCurrency(metrics.necesidadesActual - metrics.necesidadesTarget)} excedido`}
                </span>
              </div>
            </div>
          </div>

          {/* 30% DESEOS Y CONSUMO PERSONAL */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              metrics.deseosStatus === 'danger'
                ? 'bg-orange-500/5 border-orange-500/30'
                : 'bg-card border-border hover:border-violet-500/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <h4 className="font-semibold text-sm">30% Deseos & Ocio</h4>
              </div>
              <Badge
                variant={metrics.deseosStatus === 'danger' ? 'destructive' : 'outline'}
                className="text-[11px]"
              >
                {metrics.deseosPercent.toFixed(0)}%
              </Badge>
            </div>

            <div className="space-y-1 my-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">
                  {formatCurrency(metrics.deseosActual)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Meta: {formatCurrency(metrics.deseosTarget)}
                </span>
              </div>
              <Progress
                value={Math.min(100, (metrics.deseosPercent / 30) * 100)}
                className={`h-2 ${
                  metrics.deseosStatus === 'danger' ? '[&>div]:bg-orange-500' : '[&>div]:bg-violet-500'
                }`}
              />
            </div>

            <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t mt-3">
              <div className="flex justify-between">
                <span>Ocio, Salidas y Compras:</span>
                <strong className="text-foreground">
                  {formatCurrency(metrics.lifestyleExpensesAmount)}
                </strong>
              </div>
              {metrics.wishlistExpensesAmount > 0 && (
                <div className="flex justify-between text-violet-600 dark:text-violet-400">
                  <span>De tu Lista de Deseos:</span>
                  <strong>{formatCurrency(metrics.wishlistExpensesAmount)}</strong>
                </div>
              )}
              <div className="flex justify-between pt-1 font-medium">
                <span>Margen para deseos (30%):</span>
                <span
                  className={
                    metrics.deseosActual <= metrics.deseosTarget
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-orange-600 dark:text-orange-400 font-bold'
                  }
                >
                  {metrics.deseosActual <= metrics.deseosTarget
                    ? `${formatCurrency(metrics.deseosTarget - metrics.deseosActual)} para disfrutar`
                    : `+${formatCurrency(metrics.deseosActual - metrics.deseosTarget)} excedido`}
                </span>
              </div>
            </div>
          </div>

          {/* 20% AHORRO E INVERSIÓN */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              metrics.ahorroStatus === 'success'
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-card border-border hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-emerald-500" />
                <h4 className="font-semibold text-sm">20% Ahorro & Inversión</h4>
              </div>
              <Badge
                className={
                  metrics.ahorroStatus === 'success'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]'
                    : 'bg-muted text-muted-foreground text-[11px]'
                }
              >
                {metrics.ahorroPercent.toFixed(0)}%
              </Badge>
            </div>

            <div className="space-y-1 my-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(metrics.ahorroActual)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Meta: {formatCurrency(metrics.ahorroTarget)}
                </span>
              </div>
              <Progress
                value={Math.min(100, (metrics.ahorroPercent / 20) * 100)}
                className="h-2 [&>div]:bg-emerald-500"
              />
            </div>

            <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t mt-3">
              <div className="flex justify-between">
                <span>Superávit neto del período:</span>
                <strong className="text-foreground">
                  {formatCurrency(metrics.monthlyNetSavings)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Inversiones adquiridas:</span>
                <strong className="text-foreground">
                  {formatCurrency(metrics.investmentsPurchasedAmount)}
                </strong>
              </div>
              <div className="flex justify-between pt-1 font-medium">
                <span>Cumplimiento del 20%:</span>
                <span
                  className={
                    metrics.ahorroActual >= metrics.ahorroTarget
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-amber-600 dark:text-amber-400'
                  }
                >
                  {metrics.ahorroActual >= metrics.ahorroTarget
                    ? '✓ Meta alcanzada'
                    : `Faltan ${formatCurrency(metrics.ahorroTarget - metrics.ahorroActual)}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Contextual Advice Card */}
        <div className="p-3.5 rounded-xl border bg-muted/30 flex items-start gap-3 text-xs sm:text-sm">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="space-y-1 flex-1">
            <p className="font-semibold text-foreground">Diagnóstico Financiero Inteligente:</p>
            <p className="text-muted-foreground leading-relaxed">{metrics.summaryAdvice}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
