
'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Ingreso } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { IncomeForm } from './income-form';
import { Badge } from '../ui/badge';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

export function IncomeManager({ ingresos, userId }: { ingresos: Ingreso[], userId: string }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    return (
        <>
            <ManagerPage
                title="Ingresos"
                description="Registra y gestiona todas tus fuentes de ingresos."
                buttonLabel="Añadir Ingreso"
                onButtonClick={() => setIsDialogOpen(true)}
            >
                <Card>
                    <CardContent className='pt-6'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fuente</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className='text-right'>Cantidad</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ingresos.map((ingreso) => (
                                    <TableRow key={ingreso.id}>
                                        <TableCell className="font-medium">{ingreso.source}</TableCell>
                                        <TableCell>{new Date(ingreso.date).toLocaleDateString('es-ES')}</TableCell>
                                        <TableCell className='text-right'>
                                            <Badge variant="secondary" className="text-green-600 font-semibold">
                                                {formatCurrency(ingreso.amount)}
                                            </Badge>
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
                        <DialogTitle>Nuevo Ingreso</DialogTitle>
                        <DialogDescription>
                            Completa los detalles de tu ingreso.
                        </DialogDescription>
                    </DialogHeader>
                    <IncomeForm userId={userId} onFormSuccess={() => setIsDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </>
    );
}
