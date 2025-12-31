'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Categoria } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { availableIcons } from '@/lib/icons';
import { Icon } from '../icons';
import { Loader2 } from 'lucide-react';
import { saveCategoria, type ActionState } from '@/lib/actions';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Categoría'}
        </Button>
    );
}

const initialState: ActionState = { success: false, message: '' };

export function CategoryForm({ userId, category, onFormSuccess }: { userId: string, category?: Categoria, onFormSuccess: () => void }) {
    const { toast } = useToast();
    const saveCategoriaWithUserId = saveCategoria.bind(null, userId);
    const [state, dispatch] = useActionState(saveCategoriaWithUserId, initialState);
    const formRef = useRef<HTMLFormElement>(null);

     useEffect(() => {
        if (state.success) {
            toast({
                title: 'Éxito',
                description: state.message,
            });
            onFormSuccess();
            formRef.current?.reset();
        } else if (state.message && state.errors) { 
            toast({
                title: 'Error de Validación',
                description: Object.values(state.errors).flat().join('\n'),
                variant: 'destructive',
            });
        } else if (state.message) {
             toast({
                title: 'Error',
                description: state.message,
                variant: 'destructive',
            });
        }
    }, [state, onFormSuccess, toast]);

    // This effect resets the form when the `category` prop changes (i.e., when switching from 'new' to 'edit' or vice-versa)
    useEffect(() => {
        formRef.current?.reset();
    }, [category]);


    return (
        <form ref={formRef} action={dispatch} className="space-y-4">
            <input type="hidden" name="id" defaultValue={category?.id || ''} />
            <div>
                <Label htmlFor="name">Nombre de la Categoría</Label>
                <Input id="name" name="name" defaultValue={category?.name} required />
            </div>
            <div>
                <Label htmlFor="budget">Presupuesto (Opcional)</Label>
                <Input id="budget" name="budget" type="number" step="0.01" defaultValue={category?.budget} placeholder="Ej: 500" />
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
            <SubmitButton />
        </form>
    );
}
