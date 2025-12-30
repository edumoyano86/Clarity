'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Categoria } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { availableIcons } from '@/lib/icons';
import { Icon } from '../icons';
import { Loader2 } from 'lucide-react';
import { saveCategoria } from '@/lib/actions';

const initialState = { success: false, message: '', errors: {} };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Categoría'}
        </Button>
    );
}

export function CategoryForm({ category, onFormSuccess }: { category?: Categoria, onFormSuccess: () => void }) {
    const { toast } = useToast();
    const [state, dispatch] = useFormState(saveCategoria, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const [formKey, setFormKey] = useState(0);

    useEffect(() => {
        if (state.success) {
            toast({
                title: 'Éxito',
                description: state.message,
            });
            onFormSuccess();
            setFormKey(k => k + 1); // Reset form
        } else if (state.message) {
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
                {state.errors?.nombre && <p className="text-sm text-destructive mt-1">{state.errors.nombre[0]}</p>}
            </div>
            <div>
                <Label htmlFor="presupuesto">Presupuesto (Opcional)</Label>
                <Input id="presupuesto" name="presupuesto" type="number" step="0.01" defaultValue={category?.presupuesto} placeholder="Ej: 500" />
                 {state.errors?.presupuesto && <p className="text-sm text-destructive mt-1">{state.errors.presupuesto[0]}</p>}
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
                 {state.errors?.icono && <p className="text-sm text-destructive mt-1">{state.errors.icono[0]}</p>}
            </div>
            <SubmitButton />
        </form>
    );
}
