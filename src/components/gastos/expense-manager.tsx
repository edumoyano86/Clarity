
'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Categoria, Gasto } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { ExpenseForm } from './expense-form';
import { Badge } from '../ui/badge';
import { Icon } from '../icons';
import { Button } from '../ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

interface ExpenseManagerProps {
    gastos: Gasto[];
    categorias: Categoria[];
    userId: string;
}

export function ExpenseManager({ gastos, categorias, userId }: ExpenseManagerProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<Gasto | undefined>(undefined);
    const [expenseToDelete, setExpenseToDelete] = useState<Gasto | null>(null);

    const firestore = useFirestore();
    const { toast } = useToast();
    
    const getCategory = (id: string) => categorias.find(c => c.id === id);

    const handleOpenDialog = (gasto?: Gasto) => {
        setSelectedExpense(gasto);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedExpense(undefined);
    };

    const handleOpenAlert = (gasto: Gasto) => {
        setExpenseToDelete(gasto);
        setIsAlertOpen(true);
    };

    const handleCloseAlert = () => {
        setExpenseToDelete(null);
        setIsAlertOpen(false);
    };

    const handleDelete = async () => {
        if (!expenseToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'users', userId, 'expenses', expenseToDelete.id));
            toast({ title: 'Éxito', description: 'Gasto eliminado correctamente.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar el gasto.', variant: 'destructive' });
        } finally {
            handleCloseAlert();
        }
    };


    return (
        <>
            <ManagerPage
                title="Gastos"
                description="Registra y categoriza todos tus gastos."
                buttonLabel="Añadir Gasto"
                onButtonClick={() => handleOpenDialog()}
            >
                <Card>
                    <CardContent className='pt-6'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Cantidad</TableHead>
                                    <TableHead className='text-right'>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {gastos.map((gasto) => {
                                    const categoria = getCategory(gasto.categoryId);
                                    return (
                                        <TableRow key={gasto.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {categoria && <Icon name={categoria.icono} className='h-5 w-5 text-muted-foreground'/>}
                                                    <div>
                                                        <div>{categoria?.name || 'Desconocido'}</div>
                                                        {gasto.notes && <div className='text-xs text-muted-foreground'>{gasto.notes}</div>}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{new Date(gasto.date).toLocaleDateString('es-ES')}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{formatCurrency(gasto.amount)}</Badge>
                                            </TableCell>
                                            <TableCell className='text-right'>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(gasto)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenAlert(gasto)}>
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
                        <DialogTitle>{selectedExpense ? 'Editar' : 'Nuevo'} Gasto</DialogTitle>
                         <DialogDescription>
                            Completa los detalles de tu gasto.
                        </DialogDescription>
                    </DialogHeader>
                    <ExpenseForm categorias={categorias} userId={userId} expense={selectedExpense} onFormSuccess={handleCloseDialog} />
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el gasto.
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
