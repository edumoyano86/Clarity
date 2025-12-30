'use client';

import React, { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveCategoria } from '@/lib/actions';
import { Categoria } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { availableIcons } from '@/lib/icons';
import { Icon } from '../icons';
import { Loader2 } from 'lucide-react';

export function CategoryForm({ category, onFormSuccess }: { category?: Categoria, onFormSuccess: () => void }) {
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
            const result = await saveCategoria(null, formData);
            if (result?.errors) {
                Object.values(result.errors).forEach(error => {
                    toast({
                        title: 'Error de validación',
                        description: (error as string[]).join(', '),
                        variant: 'destructive',
                    });
                });
            } else if (result?.message && !result.success) {
                 toast({
                    title: 'Error',
                    description: result.message,
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Éxito',
                    description: result.message,
                });
                onFormSuccess();
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
