'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
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
import { addIngreso, type ActionState } from '@/lib/actions';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agregando...</> : 'Agregar Ingreso'}
        </Button>
    );
}

const initialState: ActionState = { success: false, message: '' };

export function IncomeForm({ onFormSuccess }: { onFormSuccess: () => void }) {
    const { toast } = useToast();
    const [state, dispatch] = useActionState(addIngreso, initialState);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const formRef = useRef<HTMLFormElement>(null);
    const [formKey, setFormKey] = useState(0);

    useEffect(() => {
        if (state.success) {
            toast({
                title: 'Éxito',
                description: state.message,
            });
            onFormSuccess();
            setDate(new Date());
            setFormKey(prevKey => prevKey + 1); // Reset form by changing key
        } else if (state.message && state.errors) { // Only show toast on validation errors
            toast({
                title: 'Error de Validación',
                description: Object.values(state.errors).flat().join('\n'),
                variant: 'destructive',
            });
        } else if (state.message) { // For other server errors
             toast({
                title: 'Error',
                description: state.message,
                variant: 'destructive',
            });
        }
    }, [state, onFormSuccess, toast]);

    return (
        <form key={formKey} ref={formRef} action={dispatch} className="space-y-4">
            <div>
                <Label htmlFor="fuente">Fuente del Ingreso</Label>
                <Input id="fuente" name="fuente" placeholder="Ej: Salario, Venta online" required />
            </div>
            <div>
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input id="cantidad" name="cantidad" type="number" step="0.01" placeholder="Ej: 1500.00" required />
            </div>
             <div>
                <Label htmlFor="fecha">Fecha</Label>
                <Popover modal={true}>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                            locale={es}
                        />
                    </PopoverContent>
                </Popover>
                <input type="hidden" name="fecha" value={date?.toISOString() || ''} />
            </div>
             <SubmitButton />
        </form>
    );
}
