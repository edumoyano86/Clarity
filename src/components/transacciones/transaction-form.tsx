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
import { collection, addDoc, doc, setDoc, runTransaction } from 'firebase/firestore';
import { Switch } from '../ui/switch';

const TransactionSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'La descripción es requerida.'),
  amount: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número.'}).positive('La cantidad debe ser un número positivo'),
  date: z.date({ required_error: 'La fecha es requerida.'}),
  categoryId: z.string().optional(),
  accountId: z.string().optional(), // For paying an account
});

type FormValues = z.infer<typeof TransactionSchema>;

interface TransactionFormProps {
    categorias: Categoria[];
    accounts: Account[];
    userId: string;
    transaction?: Transaction;
    onFormSuccess: () => void;
    activeTab: 'ingreso' | 'gasto';
}

export function TransactionForm({ categorias, accounts, userId, transaction, onFormSuccess, activeTab }: TransactionFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    
    const { register, handleSubmit, formState: { errors }, control, reset, watch } = useForm<FormValues>({
        resolver: zodResolver(TransactionSchema),
    });

    const accountId = watch('accountId');
    const amount = watch('amount');

    useEffect(() => {
        if (transaction) {
            reset({
                id: transaction.id,
                description: transaction.description,
                amount: transaction.amount,
                categoryId: transaction.categoryId,
                date: new Date(transaction.date),
                accountId: '',
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
            // Case 1: An income is being used to pay an account
            if (activeTab === 'ingreso' && data.accountId) {
                const accountRef = doc(firestore, 'users', userId, 'accounts', data.accountId);
                
                await runTransaction(firestore, async (firestoreTransaction) => {
                    const accountDoc = await firestoreTransaction.get(accountRef);
                    if (!accountDoc.exists()) {
                        throw "La cuenta seleccionada ya no existe.";
                    }
                    const currentAccountData = accountDoc.data() as Account;
                    
                    const paymentAmount = data.amount;
                    const newPaidAmount = currentAccountData.paidAmount + paymentAmount;
                    const newStatus = newPaidAmount >= currentAccountData.amount ? 'pagada' : 'pendiente';

                    // 1. Update the account
                    firestoreTransaction.update(accountRef, { paidAmount: newPaidAmount, status: newStatus });

                    // 2. Create the payment transaction record
                    const paymentTransactionData = {
                        type: 'pago' as const,
                        amount: paymentAmount,
                        date: data.date.getTime(),
                        description: data.description || `Pago de ${currentAccountData.name}`,
                        accountId: data.accountId,
                    };
                    const transactionsRef = collection(firestore, 'users', userId, 'transactions');
                    firestoreTransaction.set(doc(transactionsRef), paymentTransactionData);
                });

                toast({
                    title: 'Éxito',
                    description: 'Pago registrado y cuenta actualizada.',
                });

            } else {
                 // Case 2: Regular income or expense transaction
                const { id, accountId, ...txData } = data;
                
                const dataToSave: any = {
                    ...txData,
                    type: activeTab,
                    date: txData.date.getTime(),
                };

                // Only add categoryId for expenses
                if (activeTab === 'gasto' && dataToSave.categoryId) {
                    dataToSave.categoryId = txData.categoryId;
                } else {
                    delete dataToSave.categoryId;
                }

                const collectionRef = collection(firestore, "users", userId, "transactions");
                if (id) {
                    await setDoc(doc(collectionRef, id), dataToSave, { merge: true });
                } else {
                    await addDoc(collectionRef, dataToSave);
                }
                toast({
                    title: 'Éxito',
                    description: 'Transacción guardada exitosamente.',
                });
            }
            onFormSuccess();

        } catch (error) {
            console.error("Error saving:", error);
            const errorMessage = typeof error === 'string' ? error : (error as Error).message || 'No se pudo guardar.';
            toast({
                title: 'Error',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const pendingAccounts = accounts.filter(acc => acc.status === 'pendiente');

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <input type="hidden" {...register('id')} />
            <div>
                <Label htmlFor="description">Descripción</Label>
                <Input id="description" placeholder={activeTab === 'gasto' ? "Ej: Cena con amigos" : "Ej: Salario Mensual"} {...register('description')} />
                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
            <div>
                <Label htmlFor="amount">Cantidad</Label>
                <Input id="amount" type="number" step="0.01" placeholder="Ej: 4500.50" {...register('amount')} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            
            {activeTab === 'ingreso' && pendingAccounts.length > 0 && (
                <div>
                    <Label htmlFor="accountId">Asignar a Cuenta por Pagar (Opcional)</Label>
                    <Controller
                        name="accountId"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una cuenta para pagar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Ninguna</SelectItem>
                                    {pendingAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.name} (Saldo: ${acc.amount - acc.paidAmount})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            )}

            {activeTab === 'gasto' && (
                <div>
                    <Label htmlFor="categoryId">Categoría</Label>
                    <Controller
                        name="categoryId"
                        control={control}
                        rules={{ required: activeTab === 'gasto' ? 'La categoría es requerida' : false }}
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

            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 
                `Guardar ${accountId ? 'Pago' : (activeTab === 'gasto' ? 'Gasto' : 'Ingreso')}`
                }
            </Button>
        </form>
    );
}
