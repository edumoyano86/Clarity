'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Categoria, Transaction, Account } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { TransactionForm } from './transaction-form';
import { Badge } from '../ui/badge';
import { Icon } from '../icons';
import { Button } from '../ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

interface TransactionsManagerProps {
    transactions: Transaction[];
    categorias: Categoria[];
    accounts: Account[];
    userId: string;
}

export function TransactionsManager({ transactions, categorias, accounts, userId }: TransactionsManagerProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | undefined>(undefined);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [activeTab, setActiveTab] = useState<'ingreso' | 'gasto'>('ingreso');

    const firestore = useFirestore();
    const { toast } = useToast();
    
    const getCategory = (id: string) => categorias.find(c => c.id === id);

    const handleOpenDialog = (transaction?: Transaction) => {
        if(transaction) {
            setActiveTab(transaction.type === 'ingreso' ? 'ingreso' : 'gasto');
        } else {
            // Reset to default tab when adding a new transaction
            setActiveTab('ingreso');
        }
        setSelectedTransaction(transaction);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedTransaction(undefined);
    };

    const handleOpenAlert = (transaction: Transaction) => {
        setTransactionToDelete(transaction);
        setIsAlertOpen(true);
    };

    const handleCloseAlert = () => {
        setTransactionToDelete(null);
        setIsAlertOpen(false);
    };

    const handleDelete = async () => {
        if (!transactionToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'users', userId, 'transactions', transactionToDelete.id));
            toast({ title: 'Éxito', description: 'Transacción eliminada correctamente.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar la transacción.', variant: 'destructive' });
        } finally {
            handleCloseAlert();
        }
    };


    const renderRow = (transaction: Transaction) => {
        const categoria = transaction.categoryId ? getCategory(transaction.categoryId) : null;
        return (
            <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                     <div className="flex items-center gap-2">
                        {categoria && <Icon name={categoria.icono} className='h-5 w-5 text-muted-foreground'/>}
                        <div>
                            <div>{transaction.description}</div>
                            {transaction.type === 'pago' && <div className='text-xs text-muted-foreground'>Pago de cuenta</div>}
                        </div>
                    </div>
                </TableCell>
                <TableCell>{new Date(transaction.date).toLocaleDateString('es-ES')}</TableCell>
                <TableCell>
                    <Badge variant={transaction.type === 'ingreso' ? 'secondary' : 'outline'} className={transaction.type === 'ingreso' ? 'text-green-600' : 'text-destructive'}>
                        {transaction.type === 'ingreso' ? '+' : '-'} {formatCurrency(transaction.amount)}
                    </Badge>
                </TableCell>
                <TableCell className='text-right'>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(transaction)} disabled={transaction.type === 'pago'}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenAlert(transaction)} disabled={transaction.type === 'pago'}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </TableCell>
            </TableRow>
        )
    }

    return (
        <>
            <ManagerPage
                title="Transacciones"
                description="Registra y gestiona todos tus movimientos."
                buttonLabel="Añadir Transacción"
                onButtonClick={() => handleOpenDialog()}
            >
                <Card>
                    <CardContent className='pt-6'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Cantidad</TableHead>
                                    <TableHead className='text-right'>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map(renderRow)}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </ManagerPage>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedTransaction ? 'Editar' : 'Nueva'} Transacción</DialogTitle>
                         <DialogDescription>
                            Completa los detalles de tu movimiento.
                        </DialogDescription>
                    </DialogHeader>
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'ingreso' | 'gasto')}>
                        <TabsList className='grid w-full grid-cols-2'>
                            <TabsTrigger value='ingreso' disabled={!!selectedTransaction && selectedTransaction.type !== 'ingreso'}>Ingreso</TabsTrigger>
                            <TabsTrigger value='gasto' disabled={!!selectedTransaction && selectedTransaction.type !== 'gasto'}>Gasto</TabsTrigger>
                        </TabsList>
                        <TabsContent value='ingreso'>
                            <TransactionForm 
                                type="ingreso"
                                categorias={categorias}
                                accounts={accounts} 
                                userId={userId} 
                                transaction={selectedTransaction} 
                                onFormSuccess={handleCloseDialog}
                                activeTab={activeTab}
                            />
                        </TabsContent>
                        <TabsContent value='gasto'>
                             <TransactionForm 
                                type="gasto"
                                categorias={categorias}
                                accounts={accounts} 
                                userId={userId} 
                                transaction={selectedTransaction} 
                                onFormSuccess={handleCloseDialog}
                                activeTab={activeTab}
                             />
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente la transacción.
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
