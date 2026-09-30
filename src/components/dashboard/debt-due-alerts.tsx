'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Account } from '@/lib/definitions';
import { AlertTriangle, Clock, CheckCircle2, Wallet, ArrowRight, ShieldAlert, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount);

interface DebtDueAlertsProps {
  accounts: Account[];
  isLoading?: boolean;
}

export type UrgentAccount = Account & {
  remainingBalance: number;
  daysRemaining: number;
  urgency: 'overdue' | 'today' | 'urgent_3_days' | 'soon_5_days';
};

export function DebtDueAlerts({ accounts, isLoading }: DebtDueAlertsProps) {
  const { urgentAccounts, totalUrgentAmount, overdueCount, soonCount } = useMemo(() => {
    const now = new Date();
    // Normalize to midnight for clean day calculations
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const list: UrgentAccount[] = [];
    let sum = 0;
    let overdue = 0;
    let soon = 0;

    accounts.forEach((acc) => {
      const isPaid = acc.status === 'pagada' || acc.paidAmount >= acc.amount;
      if (isPaid) return;

      const remaining = Math.max(0, acc.amount - acc.paidAmount);
      const accDueMidnight = new Date(
        new Date(acc.dueDate).getFullYear(),
        new Date(acc.dueDate).getMonth(),
        new Date(acc.dueDate).getDate()
      ).getTime();

      const daysDiff = Math.round((accDueMidnight - todayMidnight) / oneDayMs);

      // We alert for overdue accounts or accounts due within the next 5 days
      if (daysDiff <= 5) {
        let urgency: UrgentAccount['urgency'] = 'soon_5_days';
        if (daysDiff < 0) {
          urgency = 'overdue';
          overdue++;
        } else if (daysDiff === 0) {
          urgency = 'today';
          overdue++;
        } else if (daysDiff <= 3) {
          urgency = 'urgent_3_days';
          soon++;
        } else {
          urgency = 'soon_5_days';
          soon++;
        }

        sum += remaining;
        list.push({
          ...acc,
          remainingBalance: remaining,
          daysRemaining: daysDiff,
          urgency,
        });
      }
    });

    // Sort by most urgent first (overdue < today < 1 day < 2 days...)
    list.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return {
      urgentAccounts: list,
      totalUrgentAmount: sum,
      overdueCount: overdue,
      soonCount: soon,
    };
  }, [accounts]);

  if (urgentAccounts.length === 0) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">Vencimientos de Deudas</CardTitle>
            </div>
            <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              Al día
            </Badge>
          </div>
          <CardDescription>
            No tienes deudas que venzan en los próximos 5 días.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tus pagos están bajo control y sin riesgo de recargos.</span>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <Link href="/cuentas">Ver cuentas</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasOverdue = overdueCount > 0;
  // Limit to the 4 oldest / most urgent accounts as requested
  const visibleAccounts = urgentAccounts.slice(0, 4);
  const remainingAccountsCount = urgentAccounts.length - visibleAccounts.length;

  return (
    <Card className={hasOverdue ? 'border-destructive/40 shadow-sm' : 'border-amber-500/40 shadow-sm'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {hasOverdue ? (
              <ShieldAlert className="h-5 w-5 text-destructive animate-pulse" />
            ) : (
              <Clock className="h-5 w-5 text-amber-500" />
            )}
            <CardTitle className="text-base">
              {hasOverdue ? 'Atención: Deudas por Vencer o Vencidas' : 'Alerta Preventiva de Vencimientos'}
            </CardTitle>
          </div>
          <Badge variant={hasOverdue ? 'destructive' : 'secondary'} className="font-bold">
            {urgentAccounts.length} {urgentAccounts.length === 1 ? 'cuenta' : 'cuentas'}
          </Badge>
        </div>
        <CardDescription>
          {hasOverdue
            ? `Evita recargos e intereses adicionales. Total en riesgo: ${formatCurrency(totalUrgentAmount)}`
            : `Cuentas con vencimiento en los próximos 3 a 5 días (${formatCurrency(totalUrgentAmount)})`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleAccounts.map((account) => {
          let badgeVariant: 'destructive' | 'outline' | 'secondary' = 'secondary';
          let badgeText = '';
          let badgeClasses = '';

          if (account.urgency === 'overdue') {
            badgeVariant = 'destructive';
            const daysPast = Math.abs(account.daysRemaining);
            badgeText = daysPast === 1 ? 'Venció ayer' : `Vencida hace ${daysPast} días`;
          } else if (account.urgency === 'today') {
            badgeVariant = 'destructive';
            badgeText = '¡Vence Hoy!';
            badgeClasses = 'bg-rose-600 text-white animate-pulse';
          } else if (account.urgency === 'urgent_3_days') {
            badgeText = account.daysRemaining === 1 ? 'Vence mañana' : `Vence en ${account.daysRemaining} días`;
            badgeClasses = 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-semibold';
          } else {
            badgeText = `Vence en ${account.daysRemaining} días`;
            badgeClasses = 'text-muted-foreground bg-muted';
          }

          return (
            <div
              key={account.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                account.urgency === 'overdue' || account.urgency === 'today'
                  ? 'bg-destructive/5 border-destructive/30'
                  : 'bg-card/70 border-border hover:bg-muted/30'
              }`}
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{account.name}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={badgeVariant} className={`text-[10px] px-2 py-0.5 h-4.5 ${badgeClasses}`}>
                    {badgeText}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    Fecha: {new Date(account.dueDate).toLocaleDateString('es-ES')}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="font-bold text-sm text-foreground">
                  {formatCurrency(account.remainingBalance)}
                </p>
                <Button variant="outline" size="sm" asChild className="h-7 text-xs px-2.5 mt-1">
                  <Link href="/cuentas" className="flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Pagar
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}

        <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t">
          <span>
            {remainingAccountsCount > 0
              ? `Mostrando las 4 más antiguas (+${remainingAccountsCount} más)`
              : 'Mostrando todas las cuentas en riesgo'}
          </span>
          <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs font-semibold text-primary">
            <Link href="/cuentas" className="flex items-center gap-1">
              Ver todas ({urgentAccounts.length}) <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
