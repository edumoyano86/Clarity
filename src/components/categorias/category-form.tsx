'use client';

import React, { useRef, useState, useEffect, useActionState } from 'react';
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

const initialState = {
    message: null,
    errors: {},
    success: false,
};

export function CategoryForm({ category, onFormSuccess }: { category?: Categoria, onFormSuccess: () => void }) {
    const [state, dispatch] = useActionState(saveCategoria, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [formKey, setFormKey] = useState(() => Math.random().toString());

    useEffect(() => {
        if (state.success) {
            toast({
                title: 'Éxito',
                description: state.message,
            });
            onFormSuccess();
            setFormKey(Math.random().toString());
        } else if (state.message) {
            toast({
                title: 'Error',
                description: state.message,
                variant: 'destructive',
            });
        } else if (state.errors) {
            Object.values(state.errors).forEach(error => {
                toast({
                    title: 'Error de validación',
                    description: (error as string[]).join(', '),
                    variant: 'destructive',
                });
            });
        }
    }, [state, onFormSuccess, toast]);

    return (
        <form key={formKey} ref={formRef} action={dispatch} className="space-y-4">
            <input type="hidden" name="id" value={category?.id || ''} />
            <div>
                <Label htmlFor="nombre">Nombre de la Categoría</Label>
                <Input id="nombre" name="nombre" defaultValue={category?.nombre} required />
            </div>
            <div>
                <Label htmlFor="presupuesto">Presupuesto (Opcional)</Label>
                <Input id="presupuesto" name="presupuesto" type="number" step="0.01" defaultValue={category?.presupuesto} placeholder="Ej: 500" />
            </div>
            <div>
                <Label htmlFor="icono">Icono</Label>
                <Select name="icono" defaultValue={category?.icono} required>
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
            <Button type="submit" className="w-full">
                Guardar Categoría
            </Button>
        </form>
    );
}
