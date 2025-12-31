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
import { useFirestore, useUser } from '@/firebase';
import { deleteDoc, doc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

interface AccountsManagerProps {
    accounts: Account[];
    userId: string;
}

export function AccountsManager({ accounts, userId }: AccountsManagerProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<Account | undefined>(undefined);
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

    const firestore = useFirestore();
    const { toast } = useToast();
    
    const handleOpenDialog = (account?: Account) => {
        setSelectedAccount(account);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedAccount(undefined);
    };

    const handleOpenAlert = (account: Account) => {
        setAccountToDelete(account);
        setIsAlertOpen(true);
    };

    const handleCloseAlert = () => {
        setAccountToDelete(null);
        setIsAlertOpen(false);
    };

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
    
    const handleMarkAsPaid = async (account: Account) => {
        const remainingAmount = account.amount - account.paidAmount;
        if (remainingAmount <= 0) return;

        try {
            // 1. Create a payment transaction
            const paymentTransaction = {
                type: 'pago' as const,
                amount: remainingAmount,
                date: new Date().getTime(),
                description: `Pago de ${account.name}`,
                accountId: account.id,
            };
            await addDoc(collection(firestore, 'users', userId, 'transactions'), paymentTransaction);
            
            // 2. Update the account
            await updateDoc(doc(firestore, 'users', userId, 'accounts', account.id), {
                status: 'pagada',
                paidAmount: account.amount
            });

            toast({ title: 'Éxito', description: `La cuenta ${account.name} ha sido marcada como pagada.` });

        } catch (error) {
            console.error("Error marking account as paid:", error);
            toast({ title: 'Error', description: 'No se pudo marcar la cuenta como pagada.', variant: 'destructive' });
        }
    }


    return (
        <>
            <ManagerPage
                title="Cuentas por Pagar"
                description="Gestiona tus deudas y pagos pendientes."
                buttonLabel="Añadir Cuenta"
                onButtonClick={() => handleOpenDialog()}
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
                                                    <Button variant="outline" size="sm" onClick={() => handleMarkAsPaid(account)}>
                                                        <Wallet className="h-4 w-4 mr-2"/> Pagar
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(account)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedAccount ? 'Editar' : 'Nueva'} Cuenta</DialogTitle>
                         <DialogDescription>
                            Completa los detalles de tu cuenta por pagar.
                        </DialogDescription>
                    </DialogHeader>
                    <AccountForm userId={userId} account={selectedAccount} onFormSuccess={handleCloseDialog} />
                </DialogContent>
            </Dialog>

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
