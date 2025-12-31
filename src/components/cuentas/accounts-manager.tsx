'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Account } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { AccountForm } from './account-form';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Edit, Trash2, Wallet } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { PaymentDialog } from './payment-dialog';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

interface AccountsManagerProps {
    accounts: Account[];
    userId: string;
}

export function AccountsManager({ accounts, userId }: AccountsManagerProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [accountToPay, setAccountToPay] = useState<Account | undefined>(undefined);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

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
    }

    const handleDelete = async () => {
        if (!accountToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'users', userId, 'accounts', accountToDelete.id));
            toast({ title: 'Éxito', description: 'Cuenta eliminada correctamente.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar la cuenta.', variant: 'destructive' });
        } finally {
            handleCloseAlert();
        }
    };
    
    return (
        <>
            <ManagerPage
                title="Cuentas por Pagar"
                description="Gestiona tus deudas y pagos pendientes."
                buttonLabel="Añadir/Modificar Cuenta"
                onButtonClick={() => handleOpenForm()}
            >
                <Card>
                    <CardContent className='pt-6'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Pagado</TableHead>
                                    <TableHead>Vencimiento</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className='text-right'>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accounts.map((account) => {
                                    const progress = (account.paidAmount / account.amount) * 100;
                                    return (
                                        <TableRow key={account.id} className={account.status === 'pagada' ? 'text-muted-foreground' : ''}>
                                            <TableCell className="font-medium">{account.name}</TableCell>
                                            <TableCell>{formatCurrency(account.amount)}</TableCell>
                                            <TableCell>
                                                <div className='flex flex-col gap-1'>
                                                    <span>{formatCurrency(account.paidAmount)}</span>
                                                    <Progress value={progress} className='h-2'/>
                                                </div>
                                            </TableCell>
                                            <TableCell>{new Date(account.dueDate).toLocaleDateString('es-ES')}</TableCell>
                                            <TableCell>
                                                <Badge variant={account.status === 'pagada' ? 'secondary' : 'destructive'}>{account.status}</Badge>
                                            </TableCell>
                                            <TableCell className='text-right space-x-1'>
                                                {account.status === 'pendiente' && (
                                                    <Button variant="outline" size="sm" onClick={() => handleOpenPaymentDialog(account)}>
                                                        <Wallet className="h-4 w-4 mr-2"/> Pagar
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenAlert(account)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </ManagerPage>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva Cuenta / Añadir Saldo</DialogTitle>
                         <DialogDescription>
                            Crea una nueva cuenta por pagar o añade saldo a una existente.
                        </DialogDescription>
                    </DialogHeader>
                    <AccountForm userId={userId} accounts={accounts} onFormSuccess={handleCloseForm} />
                </DialogContent>
            </Dialog>

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
