'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Investment, PriceData, PortfolioDataPoint, PriceHistory } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { InvestmentForm } from './investment-form';
import { Button } from '../ui/button';
import { Edit, Trash2, TrendingUp, TrendingDown, Loader2, DollarSign } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { PortfolioChart } from './portfolio-chart';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { SellInvestmentDialog } from './sell-investment-dialog';
import { PortfolioPeriod } from '@/hooks/use-portfolio-history';
import { format, startOfDay } from 'date-fns';

interface InvestmentsManagerProps {
    investments: Investment[];
    userId: string;
    portfolioHistory: PortfolioDataPoint[];
    totalValue: number;
    isLoading: boolean;
    prices: PriceData;
    priceHistory: PriceHistory;
    period: PortfolioPeriod;
    setPeriod: (period: PortfolioPeriod) => void;
}

const USD_TO_ARS_RATE = 1050; 

export function InvestmentsManager({ 
    investments, 
    userId, 
    portfolioHistory, 
    totalValue, 
    isLoading,
    prices,
    priceHistory,
    period, 
    setPeriod 
}: InvestmentsManagerProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
    const [selectedInvestment, setSelectedInvestment] = useState<Investment | undefined>(undefined);
    const [investmentToSell, setInvestmentToSell] = useState<Investment | undefined>(undefined);
    const [investmentToDelete, setInvestmentToDelete] = useState<Investment | null>(null);
    const [showInArs, setShowInArs] = useState(false);

    const firestore = useFirestore();
    const { toast } = useToast();

    const formatCurrency = (amount: number) => {
        if (isNaN(amount)) amount = 0;
        if (showInArs) {
            return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount * USD_TO_ARS_RATE);
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const handleOpenForm = (investment?: Investment) => {
        setSelectedInvestment(investment);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setSelectedInvestment(undefined);
    };

    const handleOpenSellDialog = (investment: Investment) => {
        setInvestmentToSell(investment);
        setIsSellDialogOpen(true);
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

    const sortedInvestments = useMemo(() => {
        if (!investments) return [];
        return [...investments].sort((a, b) => {
            const priceKeyA = a.assetType === 'crypto' ? a.coinGeckoId : a.symbol;
            const priceKeyB = b.assetType === 'crypto' ? b.coinGeckoId : b.symbol;
            const aPrice = prices[priceKeyA!]?.price || 0;
            const bPrice = prices[priceKeyB!]?.price || 0;
            const aValue = a.amount * aPrice;
            const bValue = b.amount * bPrice;
            return bValue - aValue;
        });
    }, [investments, prices]);


    const renderPortfolioRow = (investment: Investment) => {
        // Robust date validation
        const isDateInvalid = typeof investment.purchaseDate !== 'number' || isNaN(investment.purchaseDate) || investment.purchaseDate <= 0;

        if (isDateInvalid) {
            return (
                <TableRow key={investment.id}>
                    <TableCell>
                        <div className='font-medium'>{investment.name}</div>
                        <div className='text-sm text-muted-foreground'>{investment.symbol}</div>
                    </TableCell>
                    <TableCell colSpan={5} className="text-destructive text-center font-medium">
                        Fecha de compra inválida.
                    </TableCell>
                    <TableCell className='text-right space-x-0'>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(investment)} title="Editar">
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenAlert(investment)} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </TableCell>
                </TableRow>
            );
        }
        
        const priceKey = investment.assetType === 'crypto' ? investment.coinGeckoId : investment.symbol;
        
        // Find the historical price for the purchase date
        const purchaseDateStr = format(startOfDay(new Date(investment.purchaseDate)), 'yyyy-MM-dd');
        const purchasePrice = priceHistory.get(priceKey!)?.get(purchaseDateStr) || 0;
        const purchaseValue = investment.amount * purchasePrice;
        
        const currentPrice = prices[priceKey!]?.price;
        const currentValue = currentPrice ? investment.amount * currentPrice : null;
        
        const pnl = currentValue !== null && purchaseValue > 0 ? currentValue - purchaseValue : null;
        const pnlPercent = pnl !== null && purchaseValue > 0 ? (pnl / purchaseValue) * 100 : null;

        return (
            <TableRow key={investment.id}>
                <TableCell>
                    <div className='font-medium'>{investment.name}</div>
                    <div className='text-sm text-muted-foreground'>{investment.symbol}</div>
                </TableCell>
                <TableCell>{investment.amount.toFixed(4)}</TableCell>
                <TableCell>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : formatCurrency(purchasePrice)}</TableCell>
                <TableCell>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : formatCurrency(purchaseValue)}</TableCell>
                <TableCell>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : currentValue !== null ? formatCurrency(currentValue) : '-'}
                </TableCell>
                <TableCell>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        pnl !== null && pnlPercent !== null ? (
                            <div className={`flex items-center gap-1 font-medium ${pnl >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                <span>{formatCurrency(pnl)} ({pnlPercent.toFixed(2)}%)</span>
                            </div>
                        ) : '-'
                    )}
                </TableCell>
                <TableCell className='text-right space-x-0'>
                     <Button variant="ghost" size="icon" onClick={() => handleOpenSellDialog(investment)} title="Vender">
                        <DollarSign className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenForm(investment)} title="Editar">
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenAlert(investment)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </TableCell>
            </TableRow>
        )
    }

    const periodOptions: { label: string; value: PortfolioPeriod }[] = [
        { label: '7D', value: 7 },
        { label: '30D', value: 30 },
        { label: '90D', value: 90 },
    ];

    return (
        <>
            <ManagerPage
                title="Portafolio de Inversiones"
                description="Realiza un seguimiento de tus activos."
                buttonLabel="Añadir Inversión"
                onButtonClick={() => handleOpenForm()}
            >
                <div className="space-y-8">
                    <PortfolioChart 
                        portfolioHistory={portfolioHistory} 
                        totalValue={totalValue} 
                        isLoading={isLoading}
                        period={period}
                        setPeriod={setPeriod}
                        periodOptions={periodOptions}
                    />
                    <Card>
                        <CardHeader>
                            <div className='flex justify-between items-center'>
                                <CardTitle>Detalle de Activos</CardTitle>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="currency-switch"
                                        checked={showInArs}
                                        onCheckedChange={setShowInArs}
                                    />
                                    <Label htmlFor="currency-switch">Mostrar en {showInArs ? "ARS" : "USD"}</Label>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className='pt-0'>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Activo</TableHead>
                                        <TableHead>Tenencia</TableHead>
                                        <TableHead>Precio de Compra</TableHead>
                                        <TableHead>Valor de Compra</TableHead>
                                        <TableHead>Valor Actual</TableHead>
                                        <TableHead>G/P</TableHead>
                                        <TableHead className='text-right'>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center h-24">
                                                <div className="flex justify-center items-center">
                                                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                                    Cargando datos de mercado...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : investments.length > 0 ? (
                                        sortedInvestments.map(renderPortfolioRow)
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

            {investmentToSell && (
                 <SellInvestmentDialog
                    isOpen={isSellDialogOpen}
                    onOpenChange={setIsSellDialogOpen}
                    investment={investmentToSell}
                    userId={userId}
                    onSuccess={() => {
                        setIsSellDialogOpen(false);
                        setInvestmentToSell(undefined);
                    }}
                />
            )}

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
