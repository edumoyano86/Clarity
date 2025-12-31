'use client';

import React, { useState } from 'react';
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
import { collection, addDoc } from 'firebase/firestore';

const IngresoSchema = z.object({
  source: z.string({ required_error: 'La fuente es requerida.'}).min(1, 'La fuente es requerida'),
  amount: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número.'}).positive('La cantidad debe ser un número positivo'),
  date: z.date({ required_error: 'La fecha es requerida.'}),
});

type FormValues = z.infer<typeof IngresoSchema>;


export function IncomeForm({ userId, onFormSuccess }: { userId: string, onFormSuccess: () => void }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    
    const { register, handleSubmit, formState: { errors }, control } = useForm<FormValues>({
        resolver: zodResolver(IngresoSchema),
        defaultValues: {
            date: new Date(),
        }
    });

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const ingresoData = {
                ...data,
                date: data.date.getTime(),
            };
            await addDoc(collection(firestore, "users", userId, "incomes"), ingresoData);
            toast({
                title: 'Éxito',
                description: 'Ingreso agregado exitosamente.',
            });
            onFormSuccess();
        } catch (error) {
             console.error("Error adding income:", error);
            toast({
                title: 'Error',
                description: 'No se pudo agregar el ingreso.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <Label htmlFor="source">Fuente del Ingreso</Label>
                <Input id="source" placeholder="Ej: Salario, Venta online" {...register('source')} />
                {errors.source && <p className="text-sm text-destructive">{errors.source.message}</p>}
            </div>
            <div>
                <Label htmlFor="amount">Cantidad</Label>
                <Input id="amount" type="number" step="0.01" placeholder="Ej: 1500.00" {...register('amount')} />
                 {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
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
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agregando...</> : 'Agregar Ingreso'}
            </Button>
        </form>
    );
}
