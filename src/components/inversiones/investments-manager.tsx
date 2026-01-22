'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Investment, PriceData, PortfolioDataPoint, PriceHistory } from "@/lib/definitions";
import { ManagerPage } from '../shared/manager-page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { InvestmentForm } from './investment-form';
import { Button } from '../ui/button';
import { Edit, Trash2, TrendingUp, TrendingDown, Loader2, DollarSign, AlertCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { PortfolioChart } from './portfolio-chart';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { SellInvestmentDialog } from './sell-investment-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { PortfolioPeriod } from '@/app/(main)/inversiones/page';


interface InvestmentsManagerProps {
    investments: Investment[];
    userId: string;
    chartData: PortfolioDataPoint[];
    totalValue: number;
    isLoading: boolean;
    currentPrices: PriceData;
    priceHistory: PriceHistory;
    period: PortfolioPeriod;
    setPeriod: (period: PortfolioPeriod) => void;
}

const USD_TO_ARS_RATE = 1050; 

export function InvestmentsManager({ 
    investments, 
    userId, 
    chartData, 
    totalValue, 
    isLoading,
    currentPrices,
    priceHistory,
    period, 
    setPeriod,
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
            const docId = investmentToDelete.id;
            if (!docId) {
                throw new Error("ID de activo inválido para eliminar.");
            }
            await deleteDoc(doc(firestore, 'users', userId, 'investments', docId));
            toast({ title: 'Éxito', description: 'Inversión eliminada correctamente.' });
        } catch (error) {
            console.error("Error deleting investment:", error);
            toast({ title: 'Error', description: (error as Error).message || 'No se pudo eliminar la inversión.', variant: 'destructive' });
        } finally {
            handleCloseAlert();
        }
    };

    const sortedInvestments = useMemo(() => {
        if (!investments) return [];
        return [...investments].sort((a, b) => {
            const priceKeyA = a.assetType === 'crypto' ? a.coinGeckoId : a.symbol;
            const priceKeyB = b.assetType === 'crypto' ? b.coinGeckoId : b.symbol;
            
            const aPrice = (priceKeyA && currentPrices[priceKeyA]?.price) || 0;
            const bPrice = (priceKeyB && currentPrices[priceKeyB]?.price) || 0;

            const aValue = a.amount * aPrice;
            const bValue = b.amount * bPrice;
            
            return bValue - aValue;
        });
    }, [investments, currentPrices]);

    const renderPortfolioRow = (investment: Investment) => {
        const isCrypto = investment.assetType === 'crypto';
        const priceKey = isCrypto ? investment.coinGeckoId : investment.symbol;
        const isDataIncomplete = !priceKey;
        
        if (isDataIncomplete) {
             return (
                <TableRow key={investment.id || Math.random()}>
                    <TableCell>
                        <div className='font-medium'>{investment.name}</div>
                        <div className='text-sm text-muted-foreground'>{investment.symbol}</div>
                    </TableCell>
                    <TableCell colSpan={5} className="text-amber-600 text-center font-medium">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className="flex items-center gap-2 justify-center">
                                        <AlertCircle className="h-4 w-4" />
                                        Requiere Actualización
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Activo con datos inválidos. Por favor, elimínalo y vuelve a crearlo para ver su valor.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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
        
        const purchaseDateStr = new Date(investment.purchaseDate).toISOString().split('T')[0];
        const historyForAsset = priceHistory.get(priceKey);
        const purchasePrice = historyForAsset?.get(purchaseDateStr);

        const purchaseValue = purchasePrice !== undefined ? investment.amount * purchasePrice : null;
        const currentPrice = currentPrices[priceKey]?.price;
        const currentValue = currentPrice !== undefined ? investment.amount * currentPrice : null;
        
        const pnl = (currentValue !== null && purchaseValue !== null) ? currentValue - purchaseValue : null;
        const pnlPercent = (pnl !== null && purchaseValue !== null && purchaseValue > 0) ? (pnl / purchaseValue) * 100 : null;

        return (
            <TableRow key={investment.id}>
                <TableCell>
                    <div className='font-medium'>{investment.name}</div>
                    <div className='text-sm text-muted-foreground'>{investment.symbol}</div>
                </TableCell>
                <TableCell>{investment.amount.toFixed(4)}</TableCell>
                <TableCell>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (purchasePrice !== undefined ? formatCurrency(purchasePrice) : 'N/A')}</TableCell>
                <TableCell>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (purchaseValue !== null ? formatCurrency(purchaseValue) : 'N/A')}</TableCell>
                <TableCell>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : currentValue !== null ? formatCurrency(currentValue) : 'N/A'}
                </TableCell>
                <TableCell>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        pnl !== null && pnlPercent !== null ? (
                            <div className={`flex items-center gap-1 font-medium ${pnl >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                <span>{formatCurrency(pnl)} ({pnlPercent.toFixed(2)}%)</span>
                            </div>
                        ) : 'N/A'
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
                        chartData={chartData} 
                        totalValue={totalValue} 
                        isLoading={isLoading}
                        period={period}
                        setPeriod={setPeriod}
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
                                    {investments.length > 0 ? (
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
                    prices={currentPrices}
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
