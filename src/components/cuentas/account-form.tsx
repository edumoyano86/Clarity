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
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, runTransaction } from 'firebase/firestore';
import { Account } from '@/lib/definitions';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const AccountSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  amount: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número.'}).positive('La cantidad debe ser un número positivo'),
  dueDate: z.date({ required_error: 'La fecha es requerida.'}),
}).superRefine((data, ctx) => {
    if (!data.name) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['name'],
            message: 'El nombre es requerido.',
        });
    }
});

type FormValues = z.infer<typeof AccountSchema>;

interface AccountFormProps {
    userId: string;
    accounts: Account[];
    onFormSuccess: () => void;
}

export function AccountForm({ userId, accounts, onFormSuccess }: AccountFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    const [formType, setFormType] = useState<'new' | 'add'>('new');
    
    const { register, handleSubmit, formState: { errors }, control, reset, watch, setValue } = useForm<FormValues>({
        resolver: zodResolver(AccountSchema),
        defaultValues: {
            name: '',
            dueDate: new Date(),
        }
    });

    const selectedAccountId = watch('id');

    useEffect(() => {
        reset({
            id: '',
            name: '',
            amount: undefined,
            dueDate: new Date(),
        });
    }, [formType, reset]);
    
    useEffect(() => {
        if (formType === 'add' && selectedAccountId) {
             const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
             if (selectedAccount) {
                setValue('name', selectedAccount.name);
             }
        } else if (formType === 'new') {
            setValue('name', '');
        }
    }, [formType, selectedAccountId, accounts, setValue])


    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        if (!firestore) return;

        try {
            if (formType === 'new') {
                // Create a new account
                const dataToSave = {
                    name: data.name,
                    amount: data.amount,
                    dueDate: data.dueDate.getTime(),
                    status: 'pendiente' as const,
                    paidAmount: 0,
                };
                await addDoc(collection(firestore, 'users', userId, 'accounts'), dataToSave);
                 toast({
                    title: 'Éxito',
                    description: 'Nueva cuenta creada exitosamente.',
                });
            } else {
                // Add to an existing account
                if (!data.id) {
                    toast({ title: 'Error', description: 'Debes seleccionar una cuenta existente.', variant: 'destructive'});
                    setIsLoading(false);
                    return;
                }
                const accountRef = doc(firestore, 'users', userId, 'accounts', data.id);
                
                await runTransaction(firestore, async (transaction) => {
                    const accountDoc = await transaction.get(accountRef);
                    if (!accountDoc.exists()) {
                        throw new Error("La cuenta seleccionada no existe.");
                    }

                    const currentAmount = accountDoc.data().amount || 0;
                    const newAmount = currentAmount + data.amount;

                    transaction.update(accountRef, { 
                        amount: newAmount,
                        dueDate: data.dueDate.getTime(), // Update due date as well
                        status: 'pendiente' // Ensure it's pending
                    });
                });

                toast({
                    title: 'Éxito',
                    description: 'Saldo añadido a la cuenta exitosamente.',
                });
            }
            onFormSuccess();
        } catch (error) {
             console.error("Error saving account:", error);
            toast({
                title: 'Error',
                description: 'No se pudo guardar la cuenta.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            <RadioGroup
                value={formType}
                onValueChange={(value: 'new' | 'add') => setFormType(value)}
                className="grid grid-cols-2 gap-4"
                >
                <div>
                    <RadioGroupItem value="new" id="new" className="peer sr-only" />
                    <Label htmlFor="new" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        Nueva Cuenta
                    </Label>
                </div>
                <div>
                    <RadioGroupItem value="add" id="add" className="peer sr-only" />
                     <Label htmlFor="add" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                        Añadir a Existente
                    </Label>
                </div>
            </RadioGroup>

            {formType === 'new' ? (
                 <div>
                    <Label htmlFor="name">Nombre de la nueva cuenta</Label>
                    <Input id="name" placeholder="Ej: Tarjeta de Crédito, Alquiler" {...register('name')} />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
            ) : (
                <div>
                    <Label htmlFor="id">Seleccionar cuenta existente</Label>
                    <Controller
                        name="id"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una cuenta..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.filter(a => a.status === 'pendiente').map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.id && <p className="text-sm text-destructive">{errors.id.message}</p>}
                </div>
            )}

            <div>
                <Label htmlFor="amount">Monto a {formType === 'new' ? 'Total' : 'Añadir'}</Label>
                <Input id="amount" type="number" step="0.01" placeholder={formType === 'new' ? 'Ej: 50000' : 'Ej: 10000'} {...register('amount')} />
                 {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
             <div>
                <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
                <Controller
                    name="dueDate"
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
                {errors.dueDate && <p className="text-sm text-destructive">{errors.dueDate.message}</p>}
            </div>
             <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Cuenta'}
            </Button>
        </form>
    );
}
