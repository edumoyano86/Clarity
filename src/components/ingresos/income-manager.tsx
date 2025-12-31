
'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Ingreso } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { IncomeForm } from './income-form';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

export function IncomeManager({ ingresos, userId }: { ingresos: Ingreso[], userId: string }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedIncome, setSelectedIncome] = useState<Ingreso | undefined>(undefined);
    const [incomeToDelete, setIncomeToDelete] = useState<Ingreso | null>(null);

    const firestore = useFirestore();
    const { toast } = useToast();

    const handleOpenDialog = (income?: Ingreso) => {
        setSelectedIncome(income);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedIncome(undefined);
    };

    const handleOpenAlert = (income: Ingreso) => {
        setIncomeToDelete(income);
        setIsAlertOpen(true);
    };

    const handleCloseAlert = () => {
        setIncomeToDelete(null);
        setIsAlertOpen(false);
    };

    const handleDelete = async () => {
        if (!incomeToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'users', userId, 'incomes', incomeToDelete.id));
            toast({ title: 'Éxito', description: 'Ingreso eliminado correctamente.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar el ingreso.', variant: 'destructive' });
        } finally {
            handleCloseAlert();
        }
    };
    
    return (
        <>
            <ManagerPage
                title="Ingresos"
                description="Registra y gestiona todas tus fuentes de ingresos."
                buttonLabel="Añadir Ingreso"
                onButtonClick={() => handleOpenDialog()}
            >
                <Card>
                    <CardContent className='pt-6'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fuente</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Cantidad</TableHead>
                                    <TableHead className='text-right'>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ingresos.map((ingreso) => (
                                    <TableRow key={ingreso.id}>
                                        <TableCell className="font-medium">{ingreso.source}</TableCell>
                                        <TableCell>{new Date(ingreso.date).toLocaleDateString('es-ES')}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-green-600 font-semibold">
                                                {formatCurrency(ingreso.amount)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className='text-right'>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(ingreso)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenAlert(ingreso)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </ManagerPage>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedIncome ? 'Editar' : 'Nuevo'} Ingreso</DialogTitle>
                        <DialogDescription>
                            Completa los detalles de tu ingreso.
                        </DialogDescription>
                    </DialogHeader>
                    <IncomeForm userId={userId} income={selectedIncome} onFormSuccess={handleCloseDialog} />
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el ingreso.
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
