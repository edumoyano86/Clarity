
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
    
    const getCategory = (id: string) => categorias.find(c => c.id === id);

    return (
        <>
            <ManagerPage
                title="Gastos"
                description="Registra y categoriza todos tus gastos."
                buttonLabel="Añadir Gasto"
                onButtonClick={() => setIsDialogOpen(true)}
            >
                <Card>
                    <CardContent className='pt-6'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className='text-right'>Cantidad</TableHead>
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
                                            <TableCell className='text-right'>
                                                <Badge variant="outline">{formatCurrency(gasto.amount)}</Badge>
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
                        <DialogTitle>Nuevo Gasto</DialogTitle>
                         <DialogDescription>
                            Completa los detalles de tu gasto.
                        </DialogDescription>
                    </DialogHeader>
                    <ExpenseForm categorias={categorias} userId={userId} onFormSuccess={() => setIsDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </>
    );
}
