'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Investment, PriceData } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { InvestmentForm } from './investment-form';
import { Button } from '../ui/button';
import { Edit, Trash2, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
import { getStockPrices } from '@/ai/flows/stock-prices';
import { PortfolioChart } from './portfolio-chart';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';

interface InvestmentsManagerProps {
    investments: Investment[];
    userId: string;
}

export function InvestmentsManager({ investments, userId }: InvestmentsManagerProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [selectedInvestment, setSelectedInvestment] = useState<Investment | undefined>(undefined);
    const [investmentToDelete, setInvestmentToDelete] = useState<Investment | null>(null);
    const [prices, setPrices] = useState<PriceData>({});
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [usdToArsRate, setUsdToArsRate] = useState<number | undefined>(undefined);
    const [showInArs, setShowInArs] = useState(false);


    const firestore = useFirestore();
    const { toast } = useToast();

    const formatCurrency = (amount: number) => {
        if (showInArs && usdToArsRate) {
            return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount * usdToArsRate);
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    useEffect(() => {
        const fetchPrices = async () => {
            if (investments.length === 0) return;
            setIsLoadingPrices(true);

            const cryptoIds = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            const stockSymbols = [...new Set(investments.filter(i => i.assetType === 'stock').map(inv => inv.symbol))];

            try {
                const results = await Promise.all([
                    cryptoIds.length > 0 ? getCryptoPrices({ assetIds: cryptoIds }) : Promise.resolve({}),
                    stockSymbols.length > 0 ? getStockPrices({ symbols: stockSymbols }) : Promise.resolve({}),
                ]);
                const combinedPrices = { ...results[0], ...results[1] };
                setPrices(combinedPrices);

            } catch (error) {
                console.error("Failed to fetch asset prices:", error);
                toast({
                    title: 'Error de Precios',
                    description: 'No se pudieron obtener las cotizaciones de los activos.',
                    variant: 'destructive'
                });
            } finally {
                setIsLoadingPrices(false);
            }
        };

        fetchPrices();
    }, [investments, toast]);

    const handleOpenForm = (investment?: Investment) => {
        setSelectedInvestment(investment);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setSelectedInvestment(undefined);
    };

    const handleOpenAlert = (investment: Investment) => {
        setInvestmentToDelete(investment);
        setIsAlertOpen(true);
    };

    const handleCloseAlert = () => {
        setInvestmentToDelete(null);
        setIsAlertOpen(false);
    };

    const handleDelete = async () => {
        if (!investmentToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'users', userId, 'investments', investmentToDelete.id));
            toast({ title: 'Éxito', description: 'Inversión eliminada correctamente.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo eliminar la inversión.', variant: 'destructive' });
        } finally {
            handleCloseAlert();
        }
    };

    const renderPortfolioRow = (investment: Investment) => {
        const purchaseValue = investment.amount * investment.purchasePrice;
        const currentPriceKey = investment.assetType === 'crypto' ? investment.assetId : investment.symbol;
        const currentPrice = prices[currentPriceKey]?.price;
        const currentValue = currentPrice ? investment.amount * currentPrice : null;
        const pnl = currentValue !== null ? currentValue - purchaseValue : null;
        const pnlPercent = pnl !== null && purchaseValue > 0 ? (pnl / purchaseValue) * 100 : null;

        return (
            <TableRow key={investment.id}>
                <TableCell>
                    <div className='font-medium'>{investment.name}</div>
                    <div className='text-sm text-muted-foreground'>{investment.symbol.toUpperCase()}</div>
                </TableCell>
                <TableCell>{investment.amount}</TableCell>
                <TableCell>{formatCurrency(investment.purchasePrice)}</TableCell>
                <TableCell>{formatCurrency(purchaseValue)}</TableCell>
                <TableCell>
                    {currentValue !== null ? formatCurrency(currentValue) : <Loader2 className="h-4 w-4 animate-spin" />}
                </TableCell>
                <TableCell>
                    {pnl !== null && pnlPercent !== null ? (
                        <div className={`flex items-center gap-1 font-medium ${pnl >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            <span>{formatCurrency(pnl)} ({pnlPercent.toFixed(2)}%)</span>
                        </div>
                    ) : <Loader2 className="h-4 w-4 animate-spin" />}
                </TableCell>
                <TableCell className='text-right'>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenForm(investment)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenAlert(investment)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </TableCell>
            </TableRow>
        )
    }

    return (
        <>
            <ManagerPage
                title="Portafolio de Inversiones"
                description="Realiza un seguimiento de tus activos."
                buttonLabel="Añadir Inversión"
                onButtonClick={() => handleOpenForm()}
            >
                <div className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Configuración de Vista</CardTitle>
                            <CardDescription>Ajusta la moneda y la cotización para visualizar tu portafolio.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="usd-rate">Cotización USD a ARS</Label>
                                <Input 
                                    id="usd-rate" 
                                    type="number" 
                                    placeholder="Ej: 1050.50" 
                                    value={usdToArsRate || ''}
                                    onChange={(e) => setUsdToArsRate(parseFloat(e.target.value))}
                                />
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                                <Label htmlFor="currency-switch">Mostrar en {showInArs ? "ARS" : "USD"}</Label>
                                <Switch
                                    id="currency-switch"
                                    checked={showInArs}
                                    onCheckedChange={setShowInArs}
                                    disabled={!usdToArsRate || usdToArsRate <= 0}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <PortfolioChart investments={investments} prices={prices} isLoading={isLoadingPrices} displayCurrency={showInArs ? 'ARS' : 'USD'} usdToArsRate={usdToArsRate} />
                    <Card>
                        <CardContent className='pt-6'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Activo</TableHead>
                                        <TableHead>Cantidad</TableHead>
                                        <TableHead>Precio de Compra</TableHead>
                                        <TableHead>Valor de Compra</TableHead>
                                        <TableHead>Valor Actual</TableHead>
                                        <TableHead>G/P</TableHead>
                                        <TableHead className='text-right'>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {investments.length > 0 ? (
                                        investments.map(renderPortfolioRow)
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center h-24">
                                                No tienes inversiones registradas.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </ManagerPage>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedInvestment ? 'Editar' : 'Nueva'} Inversión</DialogTitle>
                        <DialogDescription>
                            Añade un nuevo activo a tu portafolio.
                        </DialogDescription>
                    </DialogHeader>
                    <InvestmentForm userId={userId} investment={selectedInvestment} onFormSuccess={handleCloseForm} />
                </DialogContent>
            </Dialog>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente la inversión.
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
