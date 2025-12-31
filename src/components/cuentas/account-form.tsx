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
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Account } from '@/lib/definitions';

const AccountSchema = z.object({
  id: z.string().optional(),
  name: z.string({ required_error: 'El nombre es requerido.'}).min(1, 'El nombre es requerido'),
  amount: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número.'}).positive('La cantidad debe ser un número positivo'),
  dueDate: z.date({ required_error: 'La fecha es requerida.'}),
});

type FormValues = z.infer<typeof AccountSchema>;

interface AccountFormProps {
    userId: string;
    account?: Account;
    onFormSuccess: () => void;
}

export function AccountForm({ userId, account, onFormSuccess }: AccountFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    
    const { register, handleSubmit, formState: { errors }, control, reset } = useForm<FormValues>({
        resolver: zodResolver(AccountSchema),
    });

    useEffect(() => {
        if (account) {
            reset({
                id: account.id,
                name: account.name,
                amount: account.amount,
                dueDate: new Date(account.dueDate),
            });
        } else {
             reset({
                id: '',
                name: '',
                amount: undefined,
                dueDate: new Date(),
            });
        }
    }, [account, reset]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const { id, ...accountData } = data;
            const dataToSave = {
                ...accountData,
                dueDate: accountData.dueDate.getTime(),
                status: account?.status || 'pendiente',
                paidAmount: account?.paidAmount || 0,
            };
            
            const collectionRef = collection(firestore, 'users', userId, 'accounts');

            if (id) {
                await setDoc(doc(collectionRef, id), dataToSave, { merge: true });
            } else {
                await addDoc(collectionRef, dataToSave);
            }

            toast({
                title: 'Éxito',
                description: 'Cuenta guardada exitosamente.',
            });
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
            <input type="hidden" {...register('id')} />
            <div>
                <Label htmlFor="name">Nombre de la cuenta</Label>
                <Input id="name" placeholder="Ej: Tarjeta de Crédito, Alquiler" {...register('name')} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div>
                <Label htmlFor="amount">Monto Total</Label>
                <Input id="amount" type="number" step="0.01" placeholder="Ej: 50000" {...register('amount')} />
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
