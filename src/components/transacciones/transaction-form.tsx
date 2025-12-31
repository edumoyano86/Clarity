'use client';

import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Categoria, Transaction, Account } from '@/lib/definitions';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, setDoc, getDoc, runTransaction } from 'firebase/firestore';
import { generateBudgetAlert } from '@/ai/flows/budget-alerts';

const TransactionSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'La descripción es requerida.'),
  amount: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número.'}).positive('La cantidad debe ser un número positivo'),
  date: z.date({ required_error: 'La fecha es requerida.'}),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
});

type FormValues = z.infer<typeof TransactionSchema>;

interface TransactionFormProps {
    type: 'ingreso' | 'gasto';
    categorias: Categoria[];
    accounts: Account[];
    userId: string;
    transaction?: Transaction;
    onFormSuccess: () => void;
}

export function TransactionForm({ type, categorias, accounts, userId, transaction, onFormSuccess }: TransactionFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    
    const { register, handleSubmit, formState: { errors }, control, reset, watch } = useForm<FormValues>({
        resolver: zodResolver(TransactionSchema),
    });

    const isGasto = type === 'gasto';

    useEffect(() => {
        if (transaction) {
            reset({
                id: transaction.id,
                description: transaction.description,
                amount: transaction.amount,
                categoryId: transaction.categoryId,
                date: new Date(transaction.date),
            });
        } else {
            reset({
                id: '',
                description: '',
                amount: undefined,
                categoryId: '',
                date: new Date(),
                accountId: '',
            });
        }
    }, [transaction, reset]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore no está disponible', variant: 'destructive'});
            setIsLoading(false);
            return;
        }

        try {
            const { id, accountId, ...txData } = data;
            
            const dataToSave = {
                ...txData,
                type: type,
                date: txData.date.getTime(),
                categoryId: isGasto ? txData.categoryId : undefined,
            };

            const transactionsColRef = collection(firestore, "users", userId, "transactions");
            
            if (id) { // Editing existing transaction
                await setDoc(doc(transactionsColRef, id), dataToSave, { merge: true });
            } else { // Creating new transaction
                await addDoc(transactionsColRef, dataToSave);

                // If it's an income and an account is selected to be paid
                if (type === 'ingreso' && accountId) {
                    const accountRef = doc(firestore, 'users', userId, 'accounts', accountId);
                    
                    await runTransaction(firestore, async (t) => {
                        const accountDoc = await t.get(accountRef);
                        if (!accountDoc.exists()) {
                            throw "La cuenta seleccionada no existe.";
                        }
                        const accountData = accountDoc.data() as Account;
                        
                        const amountToPay = Math.min(data.amount, accountData.amount - accountData.paidAmount);
                        const newPaidAmount = accountData.paidAmount + amountToPay;
                        const newStatus = newPaidAmount >= accountData.amount ? 'pagada' : 'pendiente';

                        // Create payment transaction
                        const paymentTx = {
                            type: 'pago',
                            amount: amountToPay,
                            date: data.date.getTime(),
                            description: `Pago de ${accountData.name} con ${data.description}`,
                            accountId: accountId,
                        };
                        const paymentRef = doc(collection(firestore, 'users', userId, 'transactions'));
                        t.set(paymentRef, paymentTx);

                        // Update account
                        t.update(accountRef, { paidAmount: newPaidAmount, status: newStatus });
                    });
                }
            }

            toast({
                title: 'Éxito',
                description: 'Transacción guardada exitosamente.',
            });

            // Check budget for expenses
            if (isGasto && data.categoryId) {
                const catDocRef = doc(firestore, "users", userId, "expenseCategories", data.categoryId);
                const categoriaDoc = await getDoc(catDocRef);
                
                if (categoriaDoc.exists()) {
                    const categoria = categoriaDoc.data() as Categoria;
                    if (categoria && categoria.budget && categoria.budget > 0) {
                        // This logic should be improved to query expenses in the same period
                        if (data.amount > categoria.budget) {
                             try {
                                const alertResult = await generateBudgetAlert({
                                    category: categoria.name,
                                    spentAmount: data.amount, // Simplified for this example
                                    budgetLimit: categoria.budget,
                                    userName: 'Usuario',
                                });
                                toast({
                                    title: 'Alerta de Presupuesto',
                                    description: alertResult.alertMessage,
                                    variant: 'destructive',
                                    duration: 10000,
                                });
                            } catch (error) {
                                console.error("Error generating budget alert:", error);
                            }
                        }
                    }
                }
            }
            onFormSuccess();

        } catch (error) {
            console.error("Error saving transaction:", error);
            const errorMessage = typeof error === 'string' ? error : 'No se pudo guardar la transacción.';
            toast({
                title: 'Error',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const pendingAccounts = accounts.filter(a => a.status === 'pendiente');

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <input type="hidden" {...register('id')} />
            <div>
                <Label htmlFor="description">Descripción</Label>
                <Input id="description" placeholder={isGasto ? "Ej: Cena con amigos" : "Ej: Salario Mensual"} {...register('description')} />
                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
            <div>
                <Label htmlFor="amount">Cantidad</Label>
                <Input id="amount" type="number" step="0.01" placeholder="Ej: 45.50" {...register('amount')} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            {isGasto && (
                <div>
                    <Label htmlFor="categoryId">Categoría</Label>
                    <Controller
                        name="categoryId"
                        control={control}
                        rules={{ required: isGasto ? 'La categoría es requerida' : false }}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categorias.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
                </div>
            )}
            <div>
                <Label htmlFor="date">Fecha</Label>
                <Controller
                    name="date"
                    control={control}
                    render={({ field }) => (
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                    locale={es}
                                    />
                            </PopoverContent>
                        </Popover>
                    )}
                />
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
             {!isGasto && !transaction && pendingAccounts.length > 0 && (
                <div>
                    <Label htmlFor="accountId">Asignar a cuenta (Opcional)</Label>
                    <Controller
                        name="accountId"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Saldar una cuenta pendiente" />
                                </SelectTrigger>
                                <SelectContent>
                                    {pendingAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.name} ({format(new Date(acc.dueDate), 'dd/MM/yy')}) - Restan {formatCurrency(acc.amount - acc.paidAmount)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            )}
             <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : `Guardar ${isGasto ? 'Gasto' : 'Ingreso'}`}
            </Button>
        </form>
    );
}
