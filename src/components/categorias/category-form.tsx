'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Categoria } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { availableIcons } from '@/lib/icons';
import { Icon } from '../icons';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';

const CategoriaSchema = z.object({
  id: z.string().optional(),
  name: z.string({ required_error: 'El nombre es requerido.'}).min(1, 'El nombre es requerido'),
  icono: z.string({ required_error: 'El icono es requerido.'}).min(1, 'El icono es requerido'),
  budget: z.coerce.number().min(0, 'El presupuesto debe ser un número positivo').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof CategoriaSchema>;

export function CategoryForm({ userId, category, onFormSuccess }: { userId: string, category?: Categoria, onFormSuccess: () => void }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const { register, handleSubmit, formState: { errors }, reset, control, setValue } = useForm<FormValues>({
        resolver: zodResolver(CategoriaSchema),
        defaultValues: {
            id: category?.id || '',
            name: category?.name || '',
            icono: category?.icono || '',
            budget: category?.budget || '',
        }
    });

    useEffect(() => {
        reset({
            id: category?.id || '',
            name: category?.name || '',
            icono: category?.icono || '',
            budget: category?.budget || '',
        });
    }, [category, reset]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const { id, ...categoriaData } = data;
            const dataToSave = { 
                ...categoriaData, 
                userId, 
                budget: categoriaData.budget || 0 
            };

            if (id) {
                await setDoc(doc(firestore, "expenseCategories", id), dataToSave, { merge: true });
            } else {
                await addDoc(collection(firestore, "expenseCategories"), dataToSave);
            }

            toast({
                title: 'Éxito',
                description: 'Categoría guardada exitosamente.',
            });
            onFormSuccess();
        } catch (error) {
            console.error("Error saving category:", error);
            toast({
                title: 'Error',
                description: 'No se pudo guardar la categoría.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...register('id')} />
            <div>
                <Label htmlFor="name">Nombre de la Categoría</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div>
                <Label htmlFor="budget">Presupuesto (Opcional)</Label>
                <Input id="budget" type="number" step="0.01" placeholder="Ej: 500" {...register('budget')} />
                 {errors.budget && <p className="text-sm text-destructive">{errors.budget.message}</p>}
            </div>
            <div>
                <Label htmlFor="icono">Icono</Label>
                 <Controller
                    name="icono"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un icono" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableIcons.map(iconInfo => (
                                    <SelectItem key={iconInfo.name} value={iconInfo.name}>
                                        <div className="flex items-center gap-2">
                                            <Icon name={iconInfo.name} className="h-4 w-4" />
                                            <span>{iconInfo.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.icono && <p className="text-sm text-destructive">{errors.icono.message}</p>}
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Categoría'}
            </Button>
        </form>
    );
}
