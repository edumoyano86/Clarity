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

export function CategoryForm({ category, onFormSuccess }: { category?: Categoria, onFormSuccess: () => void }) {
    const { toast } = useToast();
    const [state, dispatch] = useActionState(saveCategoria, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const [formKey, setFormKey] = useState(Date.now()); // Unique key to force re-render

     useEffect(() => {
        // When category prop changes, we want to reset the form.
        // Changing the key of the form element is the easiest way to do this.
        setFormKey(Date.now());
    }, [category]);


    useEffect(() => {
        if (state.success) {
            toast({
                title: 'Éxito',
                description: state.message,
            });
            onFormSuccess();
        } else if (state.message && state.errors) { // Validation errors
            toast({
                title: 'Error de Validación',
                description: Object.values(state.errors).flat().join('\n'),
                variant: 'destructive',
            });
        } else if (state.message) { // Other server errors
             toast({
                title: 'Error',
                description: state.message,
                variant: 'destructive',
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
            <SubmitButton />
        </form>
    );
}
