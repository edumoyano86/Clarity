'use client';

import React, { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveCategoria } from '@/lib/actions';
import { Categoria } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { availableIcons } from '@/lib/icons';
import { Icon } from '../icons';

function SubmitButton() {
    const { pending } = useFormStatus();
    return <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : 'Guardar Categoría'}</Button>;
}

export function CategoryForm({ category, onFormSuccess }: { category?: Categoria, onFormSuccess: () => void }) {
    const initialState = { message: null, errors: {} };
    const [state, dispatch] = useActionState(saveCategoria, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state.success) {
            toast({
                title: 'Éxito',
                description: state.message,
            });
            onFormSuccess();
        } else if (state.message && !state.errors) {
            toast({
                title: 'Error',
                description: state.message,
                variant: 'destructive',
            });
        }
    }, [state, toast, onFormSuccess]);

    return (
        <form action={dispatch} className="space-y-4">
            {category?.id && <input type="hidden" name="id" value={category.id} />}
            <div>
                <Label htmlFor="nombre">Nombre de la Categoría</Label>
                <Input id="nombre" name="nombre" defaultValue={category?.nombre} required />
                {state.errors?.nombre && <p className="text-sm text-destructive mt-1">{state.errors.nombre}</p>}
            </div>
            <div>
                <Label htmlFor="presupuesto">Presupuesto (Opcional)</Label>
                <Input id="presupuesto" name="presupuesto" type="number" step="0.01" defaultValue={category?.presupuesto} placeholder="Ej: 500" />
                {state.errors?.presupuesto && <p className="text-sm text-destructive mt-1">{state.errors.presupuesto}</p>}
            </div>
            <div>
                <Label htmlFor="icono">Icono</Label>
                <Select name="icono" defaultValue={category?.icono}>
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
                 {state.errors?.icono && <p className="text-sm text-destructive mt-1">{state.errors.icono}</p>}
            </div>
            <SubmitButton />
        </form>
    );
}
