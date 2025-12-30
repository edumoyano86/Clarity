'use client';

import React, { useRef, useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addIngreso } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';

export function IncomeForm({ onFormSuccess }: { onFormSuccess: () => void }) {
    const { toast } = useToast();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const formRef = useRef<HTMLFormElement>(null);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
            const result = await addIngreso(null, formData);

            if (result.success) {
                toast({
                    title: 'Éxito',
                    description: result.message,
                });
                onFormSuccess();
            } else if (result.errors) {
                 Object.values(result.errors).forEach(error => {
                    toast({
                        title: 'Error de validación',
                        description: (error as string[]).join(', '),
                        variant: 'destructive',
                    });
                });
            } else if (result.message) {
                 toast({
                    title: 'Error',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div>
                <Label htmlFor="fuente">Fuente del Ingreso</Label>
                <Input id="fuente" name="fuente" placeholder="Ej: Salario, Venta online" required disabled={isPending} />
            </div>
            <div>
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input id="cantidad" name="cantidad" type="number" step="0.01" placeholder="Ej: 1500.00" required disabled={isPending} />
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
                        disabled={isPending}
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
             <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agregando...</> : 'Agregar Ingreso'}
            </Button>
        </form>
    );
}
