'use client';

import { useState } from 'react';
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
import { Account } from '@/lib/definitions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

const PaymentSchema = (maxAmount: number) => z.object({
  amount: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número.'})
    .positive('La cantidad debe ser mayor que cero.')
    .max(maxAmount, `El pago no puede exceder el saldo restante de ${formatCurrency(maxAmount)}.`),
});

type FormValues = z.infer<ReturnType<typeof PaymentSchema>>;

interface PaymentDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    account: Account;
    userId: string;
    onSuccess: () => void;
}

export function PaymentDialog({ isOpen, onOpenChange, account, userId, onSuccess }: PaymentDialogProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);

    const remainingAmount = account.amount - account.paidAmount;
    const schema = PaymentSchema(remainingAmount);
    
    const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            amount: remainingAmount,
        }
    });

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        if (!firestore) return;

        const accountRef = doc(firestore, 'users', userId, 'accounts', account.id);

        try {
            await runTransaction(firestore, async (transaction) => {
                const accountDoc = await transaction.get(accountRef);
                if (!accountDoc.exists()) {
                    throw "La cuenta no existe.";
                }
                const currentAccountData = accountDoc.data() as Account;

                const paymentAmount = data.amount;
                const newPaidAmount = currentAccountData.paidAmount + paymentAmount;
                const newStatus = newPaidAmount >= currentAccountData.amount ? 'pagada' : 'pendiente';

                // 1. Update the account
                transaction.update(accountRef, { paidAmount: newPaidAmount, status: newStatus });

                // 2. Create a new payment transaction
                const paymentTransaction = {
                    type: 'pago' as const,
                    amount: paymentAmount,
                    date: new Date().getTime(),
                    description: `Pago de ${currentAccountData.name}`,
                    accountId: account.id,
                };
                const transactionsRef = collection(firestore, 'users', userId, 'transactions');
                transaction.set(doc(transactionsRef), paymentTransaction);
            });

            toast({
                title: 'Éxito',
                description: 'Pago registrado correctamente.',
            });
            reset();
            onSuccess();
        } catch (error) {
            console.error("Error processing payment:", error);
            toast({
                title: 'Error',
                description: 'No se pudo registrar el pago.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Pago para {account.name}</DialogTitle>
                    <DialogDescription>
                        Saldo restante: {formatCurrency(remainingAmount)}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="amount">Monto a Pagar</Label>
                        <Input id="amount" type="number" step="0.01" {...register('amount')} />
                        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</> : 'Registrar Pago'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
