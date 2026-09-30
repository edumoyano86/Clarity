'use client';

import React, { Fragment, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Account, Transaction } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { AccountForm } from './account-form';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Trash2,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowDownUp,
  Receipt,
  ChevronDown,
  ChevronRight,
  History,
  RotateCcw,
  Download,
} from 'lucide-react';
import { exportAccountsToCsv } from '@/lib/export-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { PaymentDialog } from './payment-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

interface AccountsManagerProps {
  accounts: Account[];
  transactions?: Transaction[];
  userId: string;
}

type FilterView = 'todas' | 'pendientes' | 'saldadas';

export function AccountsManager({ accounts, transactions = [], userId }: AccountsManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [accountToPay, setAccountToPay] = useState<Account | undefined>(undefined);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [filterView, setFilterView] = useState<FilterView>('todas');

  // State for expanded rows in table (to view payments inline)
  const [expandedAccountIds, setExpandedAccountIds] = useState<Set<string>>(new Set());

  // State for dedicated modal history view
  const [accountForHistoryModal, setAccountForHistoryModal] = useState<Account | null>(null);

  // State for reverting an accidental payment
  const [paymentToDelete, setPaymentToDelete] = useState<{
    payment: Transaction;
    account: Account;
  } | null>(null);

  const firestore = useFirestore();
  const { toast } = useToast();

  const handleOpenForm = () => {
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
  };

  const handleOpenAlert = (account: Account) => {
    setAccountToDelete(account);
    setIsAlertOpen(true);
  };

  const handleCloseAlert = () => {
    setAccountToDelete(null);
    setIsAlertOpen(false);
  };

  const handleOpenPaymentDialog = (account: Account) => {
    setAccountToPay(account);
    setIsPaymentDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!accountToDelete || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', userId, 'accounts', accountToDelete.id));
      toast({ title: 'Éxito', description: 'Cuenta eliminada correctamente.' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cuenta.',
        variant: 'destructive',
      });
    } finally {
      handleCloseAlert();
    }
  };

  const handleExportAccountsCsv = () => {
    if (accounts.length === 0) {
      toast({
        title: 'Sin datos',
        description: 'No hay cuentas registradas para exportar.',
      });
      return;
    }
    exportAccountsToCsv(accounts, paymentsByAccountId);
    toast({
      title: 'Reporte generado',
      description: `Se descargó el archivo CSV con ${accounts.length} cuentas por pagar para Excel.`,
    });
  };

  // Toggle inline expanded payment history
  const toggleExpand = (accountId: string) => {
    setExpandedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // Group payment transactions by accountId
  const paymentsByAccountId = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    transactions.forEach((t) => {
      if (t.type === 'pago' && t.accountId) {
        if (!map[t.accountId]) {
          map[t.accountId] = [];
        }
        map[t.accountId].push(t);
      }
    });

    // Sort payments within each account by date descending (most recent first)
    Object.keys(map).forEach((accId) => {
      map[accId].sort((a, b) => b.date - a.date);
    });

    return map;
  }, [transactions]);

  // Revert / Delete an accidental payment transaction safely
  const handleRevertPayment = async () => {
    if (!paymentToDelete || !firestore) return;
    const { payment, account } = paymentToDelete;

    try {
      await runTransaction(firestore, async (transaction) => {
        const accountRef = doc(firestore, 'users', userId, 'accounts', account.id);
        const paymentDocRef = doc(firestore, 'users', userId, 'transactions', payment.id);

        const accDoc = await transaction.get(accountRef);
        if (!accDoc.exists()) {
          throw new Error('La cuenta no existe.');
        }

        const accData = accDoc.data() as Account;
        const newPaidAmount = Math.max(0, accData.paidAmount - payment.amount);
        const newStatus = newPaidAmount >= accData.amount ? 'pagada' : 'pendiente';

        transaction.update(accountRef, {
          paidAmount: newPaidAmount,
          status: newStatus,
        });
        transaction.delete(paymentDocRef);
      });

      toast({
        title: 'Abono revertido',
        description: `Se anuló el pago de ${formatCurrency(payment.amount)} y se actualizó el saldo.`,
      });
    } catch (error) {
      console.error('Error reverting payment:', error);
      toast({
        title: 'Error',
        description: 'No se pudo revertir el abono.',
        variant: 'destructive',
      });
    } finally {
      setPaymentToDelete(null);
    }
  };

  // Separate accounts into pending (owed) and paid (settled)
  const { pendingAccounts, paidAccounts, totalDebtPending, totalPaid, overallProgress } = useMemo(() => {
    const pending: Account[] = [];
    const paid: Account[] = [];
    let debtSum = 0;
    let paidSum = 0;
    let totalOriginalAmount = 0;

    accounts.forEach((acc) => {
      const isSettled = acc.status === 'pagada' || acc.paidAmount >= acc.amount;
      const remaining = Math.max(0, acc.amount - acc.paidAmount);
      totalOriginalAmount += acc.amount;
      paidSum += acc.paidAmount;

      if (isSettled) {
        paid.push(acc);
      } else {
        pending.push(acc);
        debtSum += remaining;
      }
    });

    // Pending debts sorted by dueDate ASC (earliest due dates first)
    pending.sort((a, b) => a.dueDate - b.dueDate);
    // Paid debts sorted by dueDate DESC (most recent at top of paid block)
    paid.sort((a, b) => b.dueDate - a.dueDate);

    const progressPercent = totalOriginalAmount > 0 ? (paidSum / totalOriginalAmount) * 100 : 0;

    return {
      pendingAccounts: pending,
      paidAccounts: paid,
      totalDebtPending: debtSum,
      totalPaid: paidSum,
      overallProgress: progressPercent,
    };
  }, [accounts]);

  // Active displayed accounts based on selected filter
  const displayedAccounts = useMemo(() => {
    if (filterView === 'pendientes') return pendingAccounts;
    if (filterView === 'saldadas') return paidAccounts;
    // In 'todas': pending accounts ALWAYS come first, paid accounts go to the very end
    return [...pendingAccounts, ...paidAccounts];
  }, [filterView, pendingAccounts, paidAccounts]);

  const now = Date.now();

  return (
    <>
      <ManagerPage
        title="Cuentas por Pagar"
        description="Gestiona tus deudas, consulta el desglose de abonos parciales y visualiza pagos finalizados al final."
        buttonLabel="Añadir / Modificar Cuenta"
        onButtonClick={() => handleOpenForm()}
      >
        {/* KPI Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-destructive">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Deuda Pendiente
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(totalDebtPending)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingAccounts.length}{' '}
                {pendingAccounts.length === 1 ? 'cuenta activa' : 'cuentas activas por pagar'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pagado / Saldado
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalPaid)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {paidAccounts.length}{' '}
                {paidAccounts.length === 1 ? 'deuda liquidada al 100%' : 'deudas liquidadas al 100%'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Progreso General de Cancelación
              </CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallProgress.toFixed(1)}%</div>
              <Progress value={overallProgress} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Filter Selector & List Card */}
        <Card>
          <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Filtrar:</span>
              <div className="inline-flex rounded-lg border p-1 bg-muted/40">
                <Button
                  variant={filterView === 'todas' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterView('todas')}
                  className="h-7 text-xs px-3"
                >
                  Todas ({accounts.length})
                </Button>
                <Button
                  variant={filterView === 'pendientes' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterView('pendientes')}
                  className="h-7 text-xs px-3"
                >
                  Pendientes ({pendingAccounts.length})
                </Button>
                <Button
                  variant={filterView === 'saldadas' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterView('saldadas')}
                  className="h-7 text-xs px-3"
                >
                  Saldadas ({paidAccounts.length})
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {filterView === 'todas' && paidAccounts.length > 0 && pendingAccounts.length > 0 && (
                <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                  <ArrowDownUp className="h-3 w-3" /> Deudas activas arriba · Saldadas al final
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAccountsCsv}
                className="h-7 text-xs"
                title="Descargar reporte en formato CSV compatible con Excel"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </div>
          </div>

          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Monto Total</TableHead>
                  <TableHead>Pagado / Abonos</TableHead>
                  <TableHead>Saldo Pendiente</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedAccounts.map((account, index) => {
                  const isPaid = account.status === 'pagada' || account.paidAmount >= account.amount;
                  const progress = account.amount > 0 ? (account.paidAmount / account.amount) * 100 : 0;
                  const remainingBalance = Math.max(0, account.amount - account.paidAmount);
                  const isOverdue = !isPaid && account.dueDate < now;

                  const isExpanded = expandedAccountIds.has(account.id);
                  const accountPayments = paymentsByAccountId[account.id] || [];

                  return (
                    <Fragment key={account.id}>
                      <TableRow
                        className={
                          isPaid
                            ? 'text-muted-foreground bg-muted/20 hover:bg-muted/30 transition-colors'
                            : isOverdue
                            ? 'bg-destructive/5 hover:bg-destructive/10 transition-colors'
                            : 'hover:bg-muted/10 transition-colors'
                        }
                      >
                        {/* Expand chevron button */}
                        <TableCell className="w-8 px-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => toggleExpand(account.id)}
                            title={isExpanded ? 'Ocultar abonos' : 'Ver abonos parciales'}
                          >
                            <ChevronRight
                              className={`h-4 w-4 transition-transform duration-200 ${
                                isExpanded ? 'rotate-90 text-primary' : ''
                              }`}
                            />
                          </Button>
                        </TableCell>

                        {/* Name */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isPaid ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            ) : isOverdue ? (
                              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            )}
                            <span className={isPaid ? 'line-through opacity-80' : ''}>
                              {account.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Amount */}
                        <TableCell>{formatCurrency(account.amount)}</TableCell>

                        {/* Paid + Abonos Toggle Link */}
                        <TableCell>
                          <div className="flex flex-col gap-1 min-w-[140px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">
                                {formatCurrency(account.paidAmount)}
                              </span>
                              <span className="text-muted-foreground font-semibold">
                                {progress.toFixed(0)}%
                              </span>
                            </div>
                            <Progress
                              value={progress}
                              className={`h-2 ${isPaid ? '[&>div]:bg-emerald-500' : ''}`}
                            />

                            {/* Dropdown toggle button with payment count */}
                            <button
                              type="button"
                              onClick={() => toggleExpand(account.id)}
                              className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mt-1 w-fit transition-colors"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>
                                {accountPayments.length === 0
                                  ? 'Sin abonos aún'
                                  : `${accountPayments.length} ${
                                      accountPayments.length === 1 ? 'abono' : 'abonos'
                                    }`}
                              </span>
                              <ChevronDown
                                className={`h-3 w-3 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          </div>
                        </TableCell>

                        {/* Remaining balance */}
                        <TableCell
                          className={`font-bold ${
                            isPaid ? 'text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {formatCurrency(remainingBalance)}
                        </TableCell>

                        {/* Due date */}
                        <TableCell>
                          <span className={isOverdue ? 'text-destructive font-semibold' : ''}>
                            {new Date(account.dueDate).toLocaleDateString('es-ES')}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {isPaid ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                              Saldada
                            </Badge>
                          ) : isOverdue ? (
                            <Badge variant="destructive">Vencida</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-amber-600 dark:text-amber-400 border-amber-500/30"
                            >
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right space-x-1">
                          {/* Payment history modal button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAccountForHistoryModal(account)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Historial de abonos"
                          >
                            <History className="h-4 w-4" />
                          </Button>

                          {!isPaid && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPaymentDialog(account)}
                            >
                              <Wallet className="h-4 w-4 mr-1.5" /> Pagar
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenAlert(account)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expandable row: Payments History for this specific debt */}
                      {isExpanded && (
                        <TableRow className="bg-muted/20 hover:bg-muted/25 transition-colors border-b">
                          <TableCell colSpan={8} className="p-4 pl-10 pr-6">
                            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                    <Receipt className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <h5 className="font-semibold text-sm">
                                      Historial de Abonos: {account.name}
                                    </h5>
                                    <p className="text-xs text-muted-foreground">
                                      Registro de pagos parciales realizados sobre esta cuenta.
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <span>
                                    Total Abonado:{' '}
                                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                                      {formatCurrency(account.paidAmount)}
                                    </strong>
                                  </span>
                                  <span>·</span>
                                  <span>
                                    Resta por Pagar:{' '}
                                    <strong className="text-foreground font-bold">
                                      {formatCurrency(remainingBalance)}
                                    </strong>
                                  </span>
                                </div>
                              </div>

                              {accountPayments.length === 0 ? (
                                <div className="py-4 text-center text-xs text-muted-foreground space-y-1">
                                  <p className="italic">
                                    No se registran abonos parciales para esta cuenta todavía.
                                  </p>
                                  {!isPaid && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={() => handleOpenPaymentDialog(account)}
                                      className="text-xs p-0 h-auto font-medium text-primary"
                                    >
                                      Haz clic aquí para registrar el primer abono
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <div className="divide-y rounded-lg border bg-background/80 overflow-hidden text-xs">
                                  <div className="grid grid-cols-12 bg-muted/60 p-2.5 font-semibold text-muted-foreground">
                                    <span className="col-span-1">Nº</span>
                                    <span className="col-span-4">Fecha y Hora</span>
                                    <span className="col-span-4">Detalle / Concepto</span>
                                    <span className="col-span-2 text-right">Monto Abonado</span>
                                    <span className="col-span-1 text-center">Acción</span>
                                  </div>

                                  {accountPayments.map((p, idx) => {
                                    const pct =
                                      account.amount > 0 ? (p.amount / account.amount) * 100 : 0;
                                    return (
                                      <div
                                        key={p.id}
                                        className="grid grid-cols-12 items-center p-2.5 hover:bg-muted/30 transition-colors"
                                      >
                                        <span className="col-span-1 font-semibold text-muted-foreground">
                                          #{accountPayments.length - idx}
                                        </span>
                                        <span className="col-span-4 font-medium flex items-center gap-1.5">
                                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                          {format(new Date(p.date), "dd/MM/yyyy HH:mm 'hs'", {
                                            locale: es,
                                          })}
                                        </span>
                                        <span className="col-span-4 text-muted-foreground truncate">
                                          {p.description || `Pago a cuenta: ${account.name}`}
                                        </span>
                                        <div className="col-span-2 text-right">
                                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                            +{formatCurrency(p.amount)}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground block">
                                            ({pct.toFixed(0)}% del total)
                                          </span>
                                        </div>
                                        <div className="col-span-1 text-center">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                            onClick={() =>
                                              setPaymentToDelete({ payment: p, account })
                                            }
                                            title="Anular / Revertir este abono"
                                          >
                                            <RotateCcw className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}

                {displayedAccounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      {filterView === 'pendientes'
                        ? '¡Felicitaciones! No tienes deudas pendientes por pagar.'
                        : filterView === 'saldadas'
                        ? 'No tienes deudas saldadas registradas aún.'
                        : 'No tienes cuentas por pagar registradas.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </ManagerPage>

      {/* Modal Dialog: Full Dedicated Payment History View */}
      <Dialog
        open={!!accountForHistoryModal}
        onOpenChange={(open) => !open && setAccountForHistoryModal(null)}
      >
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historial de Abonos: {accountForHistoryModal?.name}
            </DialogTitle>
            <DialogDescription>
              Consulta todos los pagos parciales aplicados a esta deuda.
            </DialogDescription>
          </DialogHeader>

          {accountForHistoryModal && (
            <div className="space-y-4 py-2">
              {/* Summary of this account */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/30 text-center text-xs">
                <div>
                  <p className="text-muted-foreground">Monto Total</p>
                  <p className="font-bold text-sm mt-0.5">
                    {formatCurrency(accountForHistoryModal.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Pagado</p>
                  <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(accountForHistoryModal.paidAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Saldo Restante</p>
                  <p className="font-bold text-sm text-destructive mt-0.5">
                    {formatCurrency(
                      Math.max(
                        0,
                        accountForHistoryModal.amount - accountForHistoryModal.paidAmount
                      )
                    )}
                  </p>
                </div>
              </div>

              {/* Payments List */}
              {(() => {
                const modalPayments = paymentsByAccountId[accountForHistoryModal.id] || [];
                if (modalPayments.length === 0) {
                  return (
                    <div className="py-8 text-center text-muted-foreground text-sm space-y-2">
                      <Receipt className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p>No se registran abonos para esta cuenta todavía.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {modalPayments.map((p, idx) => {
                      const pct =
                        accountForHistoryModal.amount > 0
                          ? (p.amount / accountForHistoryModal.amount) * 100
                          : 0;

                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-semibold">
                                Abono #{modalPayments.length - idx}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(p.date), "dd/MM/yyyy HH:mm 'hs'", {
                                  locale: es,
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                              {p.description || 'Abono a cuenta'}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 block">
                                +{formatCurrency(p.amount)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {pct.toFixed(0)}% del total
                              </span>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setPaymentToDelete({
                                  payment: p,
                                  account: accountForHistoryModal,
                                });
                              }}
                              title="Revertir este abono"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountForHistoryModal(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation to revert an accidental payment */}
      <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              ¿Revertir este abono?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará este registro de pago de{' '}
              <span className="font-bold text-foreground">
                {paymentToDelete ? formatCurrency(paymentToDelete.payment.amount) : '$0'}
              </span>{' '}
              y el saldo pendiente de{' '}
              <span className="font-bold text-foreground">
                "{paymentToDelete?.account.name}"
              </span>{' '}
              se recalculará automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPaymentToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevertPayment} className="bg-amber-600 hover:bg-amber-700">
              Sí, revertir abono
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create / Edit Account Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Cuenta / Añadir Saldo</DialogTitle>
            <DialogDescription>
              Crea una nueva cuenta por pagar o añade saldo a una deuda existente.
            </DialogDescription>
          </DialogHeader>
          <AccountForm userId={userId} accounts={accounts} onFormSuccess={handleCloseForm} />
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      {accountToPay && (
        <PaymentDialog
          isOpen={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          account={accountToPay}
          userId={userId}
          onSuccess={() => {
            setIsPaymentDialogOpen(false);
            setAccountToPay(undefined);
          }}
        />
      )}

      {/* Delete Account Alert */}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseAlert}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
