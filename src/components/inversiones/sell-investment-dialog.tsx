
'use client';

import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, runTransaction } from 'firebase/firestore';
import { Investment, PriceData } from '@/lib/definitions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

const formatNumber = (amount: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(amount);
};
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const SellInvestmentSchema = (maxAmount: number) => z.object({
  amount: z.coerce.number({ required_error: 'La cantidad es requerida.'})
    .positive('La cantidad debe ser mayor que cero.')
    .max(maxAmount, `No puedes vender más de ${formatNumber(maxAmount)}.`),
  sellPrice: z.coerce.number({ required_error: 'El precio es requerido.'}).positive('El precio de venta debe ser mayor que cero.'),
});

interface SellInvestmentDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    investment: Investment;
    userId: string;
    prices: PriceData;
    onSuccess: () => void;
}

export function SellInvestmentDialog({ isOpen, onOpenChange, investment, userId, prices, onSuccess }: SellInvestmentDialogProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);

    const schema = SellInvestmentSchema(investment.amount);
    type FormValues = z.infer<typeof schema>;
    
    const priceKey = investment.assetType === 'crypto' ? (investment.coinGeckoId || investment.id) : investment.symbol;
    const currentPrice = prices[priceKey]?.price;

    const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            sellPrice: currentPrice || undefined,
        }
    });

    // Update default price if it loads after the dialog is opened
    useEffect(() => {
        if(isOpen && currentPrice) {
            reset({sellPrice: currentPrice});
        }
    }, [isOpen, currentPrice, reset]);

    const sellAmount = watch('amount');
    const sellPrice = watch('sellPrice');
    const totalSaleValue = (sellAmount && sellPrice) ? sellAmount * sellPrice : 0;

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        if (!firestore) return;

        const investmentRef = doc(firestore, 'users', userId, 'investments', investment.id);
        const transactionsRef = collection(firestore, 'users', userId, 'transactions');
        
        try {
            await runTransaction(firestore, async (transaction) => {
                const investmentDoc = await transaction.get(investmentRef);
                if (!investmentDoc.exists()) {
                    throw "La inversión que intentas vender ya no existe.";
                }
                const currentInvestment = investmentDoc.data() as Investment;

                const remainingAmount = currentInvestment.amount - data.amount;

                // 1. Update or delete the investment document
                if (remainingAmount > 1e-8) { // Use a small epsilon for float comparison
                    transaction.update(investmentRef, { amount: remainingAmount });
                } else {
                    transaction.delete(investmentRef);
                }

                // 2. Create a new income transaction for the sale
                const totalValue = data.amount * data.sellPrice;
                const incomeTransaction = {
                    type: 'ingreso' as const,
                    amount: totalValue,
                    date: new Date().getTime(),
                    description: `Venta de ${formatNumber(data.amount)} ${currentInvestment.symbol.toUpperCase()}`,
                };
                transaction.set(doc(transactionsRef), incomeTransaction);
            });

            toast({
                title: 'Éxito',
                description: 'Venta registrada correctamente.',
            });
            reset();
            onSuccess();
        } catch (error) {
            console.error("Error processing sale:", error);
            toast({
                title: 'Error',
                description: typeof error === 'string' ? error : 'No se pudo registrar la venta.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if(!open) reset(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Vender {investment.name} ({investment.symbol})</DialogTitle>
                    <DialogDescription>
                        Cantidad disponible: {formatNumber(investment.amount)}. Precio actual: {currentPrice ? formatCurrency(currentPrice) : 'Cargando...'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="amount">Cantidad a Vender</Label>
                        <Input id="amount" type="number" step="any" {...register('amount')} />
                        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="sellPrice">Precio de Venta (por unidad, en USD)</Label>
                        <Input id="sellPrice" type="number" step="any" {...register('sellPrice')} />
                        {errors.sellPrice && <p className="text-sm text-destructive">{errors.sellPrice.message}</p>}
                    </div>
                    <div className="rounded-md border bg-muted p-3">
                        <p className="text-sm font-medium text-muted-foreground">Valor total de la venta</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalSaleValue)}</p>
                    </div>

                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando Venta...</> : 'Confirmar Venta'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
