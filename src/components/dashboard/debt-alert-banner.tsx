'use client';

import { useMemo, useState } from 'react';
import { Account } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, ArrowRight, X, Wallet } from 'lucide-react';
import Link from 'next/link';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(amount);

interface DebtAlertBannerProps {
  accounts: Account[];
}

export function DebtAlertBanner({ accounts }: DebtAlertBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const { urgentCount, overdueCount, totalAmount, mostUrgentText } = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    let count = 0;
    let overdue = 0;
    let sum = 0;
    let minDays = 999;
    let minAccountName = '';

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

      // We alert for overdue or due within 5 days
      if (daysDiff <= 5) {
        count++;
        sum += remaining;
        if (daysDiff < 0) overdue++;
        if (daysDiff < minDays) {
          minDays = daysDiff;
          minAccountName = acc.name;
        }
      }
    });

    let urgentDescription = '';
    if (minDays < 0) {
      urgentDescription = `"${minAccountName}" se encuentra vencida`;
    } else if (minDays === 0) {
      urgentDescription = `"${minAccountName}" vence hoy`;
    } else if (minDays === 1) {
      urgentDescription = `"${minAccountName}" vence mañana`;
    } else if (minDays <= 5) {
      urgentDescription = `"${minAccountName}" vence en ${minDays} días`;
    }

    return {
      urgentCount: count,
      overdueCount: overdue,
      totalAmount: sum,
      mostUrgentText: urgentDescription,
    };
  }, [accounts]);

  if (isDismissed || urgentCount === 0) {
    return null;
  }

  const isSevere = overdueCount > 0;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 shadow-sm transition-all ${
        isSevere
          ? 'bg-destructive/10 border-destructive/30 text-destructive-foreground'
          : 'bg-amber-500/10 border-amber-500/30 text-foreground'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg flex items-center justify-center ${
              isSevere ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white'
            }`}
          >
            {isSevere ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </div>
          <div>
            <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2">
              <span>
                {isSevere
                  ? '¡Atención! Tienes cuentas por pagar vencidas o urgentes'
                  : 'Alerta preventiva: Próximos vencimientos de deudas'}
              </span>
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Tienes <span className="font-semibold text-foreground">{urgentCount} {urgentCount === 1 ? 'cuenta' : 'cuentas'}</span> que requiere{urgentCount === 1 ? '' : 'n'} atención ({mostUrgentText}) por un saldo total de{' '}
              <span className="font-bold text-foreground">{formatCurrency(totalAmount)}</span>. Evita recargos e intereses adicionales.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            size="sm"
            asChild
            className={
              isSevere
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs'
                : 'bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs'
            }
          >
            <Link href="/cuentas" className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Ver y pagar cuentas
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDismissed(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
