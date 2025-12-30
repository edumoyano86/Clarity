'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addIngreso } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';

function SubmitButton() {
    const { pending } = useFormStatus();
    return <Button type="submit" disabled={pending}>{pending ? 'Agregando...' : 'Agregar Ingreso'}</Button>;
}

export function IncomeForm({ onFormSuccess }: { onFormSuccess: () => void }) {
    const initialState = { message: null, errors: {}, success: false };
    const [state, dispatch] = useActionState(addIngreso, initialState);
    const { toast } = useToast();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.success) {
            toast({
                title: 'Éxito',
                description: state.message,
            });
            onFormSuccess();
            formRef.current?.reset();
            setDate(new Date());
        } else if (state.message && !state.success && state.errors) {
            toast({
                title: 'Error',
                description: state.message,
                variant: 'destructive',
            });
        }
    }, [state, toast, onFormSuccess]);

    return (
        <form ref={formRef} action={dispatch} className="space-y-4">
            <div>
                <Label htmlFor="fuente">Fuente del Ingreso</Label>
                <Input id="fuente" name="fuente" placeholder="Ej: Salario, Venta online" required />
                {state.errors?.fuente && <p className="text-sm text-destructive mt-1">{state.errors.fuente}</p>}
            </div>
            <div>
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input id="cantidad" name="cantidad" type="number" step="0.01" placeholder="Ej: 1500.00" required />
                {state.errors?.cantidad && <p className="text-sm text-destructive mt-1">{state.errors.cantidad}</p>}
            </div>
             <div>
                <Label htmlFor="fecha">Fecha</Label>
                <Popover>
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
                <input type="hidden" name="fecha" value={date?.toISOString()} />
                 {state.errors?.fecha && <p className="text-sm text-destructive mt-1">{state.errors.fecha}</p>}
            </div>
            <SubmitButton />
        </form>
    );
}
