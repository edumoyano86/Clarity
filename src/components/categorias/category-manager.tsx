
'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Categoria } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { CategoryForm } from './category-form';
import { Button } from '../ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { Icon } from '../icons';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount?: number) => {
    if (typeof amount !== 'number') return '-';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

export function CategoryManager({ categorias, userId }: { categorias: Categoria[], userId: string }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Categoria | undefined>(undefined);
    const [categoryToDelete, setCategoryToDelete] = useState<Categoria | null>(null);

    const firestore = useFirestore();
    const { toast } = useToast();

    const handleOpenDialog = (category?: Categoria) => {
        setSelectedCategory(category);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setSelectedCategory(undefined);
    }

    const handleOpenAlert = (category: Categoria) => {
        setCategoryToDelete(category);
        setIsAlertOpen(true);
    };

    const handleCloseAlert = () => {
        setCategoryToDelete(null);
        setIsAlertOpen(false);
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;
        try {
            const docRef = doc(firestore, 'users', userId, 'expenseCategories', categoryToDelete.id);
            await deleteDoc(docRef);
            toast({ title: 'Éxito', description: 'Categoría eliminada correctamente.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar la categoría.', variant: 'destructive' });
        } finally {
            handleCloseAlert();
        }
    };


    return (
        <>
            <ManagerPage
                title="Categorías de Gastos"
                description="Gestiona tus categorías y establece límites de presupuesto."
                buttonLabel="Añadir Categoría"
                onButtonClick={() => handleOpenDialog()}
            >
                <Card>
                    <CardContent className='pt-6'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Presupuesto</TableHead>
                                    <TableHead className='text-right'>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categorias.map((categoria) => (
                                    <TableRow key={categoria.id}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <Icon name={categoria.icono} className='h-5 w-5 text-muted-foreground' />
                                            {categoria.name}
                                        </TableCell>
                                        <TableCell>{formatCurrency(categoria.budget)}</TableCell>
                                        <TableCell className='text-right'>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(categoria)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenAlert(categoria)}>
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
                        <DialogTitle>{selectedCategory ? 'Editar' : 'Nueva'} Categoría</DialogTitle>
                        <DialogDescription>
                            Completa los detalles de la categoría.
                        </DialogDescription>
                    </DialogHeader>
                    <CategoryForm userId={userId} category={selectedCategory} onFormSuccess={handleCloseDialog} />
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente la categoría.
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
