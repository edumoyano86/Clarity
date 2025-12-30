'use client';

import React, { useRef, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Categoria } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { availableIcons } from '@/lib/icons';
import { Icon } from '../icons';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { saveCategoria } from '@/lib/client-actions';

const CategoriaSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  icono: z.string().min(1, 'El icono es requerido'),
  presupuesto: z.coerce.number().min(0, 'El presupuesto debe ser un número positivo').optional(),
});

export function CategoryForm({ category, onFormSuccess }: { category?: Categoria, onFormSuccess: () => void }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const formRef = useRef<HTMLFormElement>(null);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!firestore) {
            toast({ title: 'Error', description: 'No se pudo conectar a la base de datos.', variant: 'destructive' });
            return;
        }

        const formData = new FormData(event.currentTarget);
        const data = {
            id: formData.get('id') || undefined,
            nombre: formData.get('nombre'),
            icono: formData.get('icono'),
            presupuesto: formData.get('presupuesto') || 0,
        };

        const validatedFields = CategoriaSchema.safeParse(data);

         if (!validatedFields.success) {
            Object.values(validatedFields.error.flatten().fieldErrors).forEach(error => {
                toast({
                    title: 'Error de validación',
                    description: (error as string[]).join(', '),
                    variant: 'destructive',
                });
            });
            return;
        }


        startTransition(async () => {
            try {
                await saveCategoria(firestore, validatedFields.data);
                toast({
                    title: 'Éxito',
                    description: 'Categoría guardada exitosamente.',
                });
                onFormSuccess();
            } catch (e) {
                console.error(e);
                 toast({
                    title: 'Error',
                    description: 'No se pudo guardar la categoría.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="id" value={category?.id || ''} />
            <div>
                <Label htmlFor="nombre">Nombre de la Categoría</Label>
                <Input id="nombre" name="nombre" defaultValue={category?.nombre} required disabled={isPending} />
            </div>
            <div>
                <Label htmlFor="presupuesto">Presupuesto (Opcional)</Label>
                <Input id="presupuesto" name="presupuesto" type="number" step="0.01" defaultValue={category?.presupuesto} placeholder="Ej: 500" disabled={isPending} />
            </div>
            <div>
                <Label htmlFor="icono">Icono</Label>
                <Select name="icono" defaultValue={category?.icono} required disabled={isPending}>
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
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
                 {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Categoría'}
            </Button>
        </form>
    );
}
