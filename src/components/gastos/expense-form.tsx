'use client';

import React, { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addGasto } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Categoria } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';

interface ExpenseFormProps {
    categorias: Categoria[];
    onFormSuccess: () => void;
}

export function ExpenseForm({ categorias, onFormSuccess }: ExpenseFormProps) {
    const { toast } = useToast();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const formRef = useRef<HTMLFormElement>(null);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
            const result = await addGasto(null, formData);
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
                if (result.alertMessage) {
                    toast({
                        title: 'Alerta de Presupuesto',
                        description: result.alertMessage,
                        variant: 'destructive',
                        duration: 10000,
                    });
                }
                onFormSuccess();
            }
        });
    };


    return (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div>
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input id="cantidad" name="cantidad" type="number" step="0.01" placeholder="Ej: 45.50" required disabled={isPending} />
            </div>
            <div>
                <Label htmlFor="categoriaId">Categoría</Label>
                 <Select name="categoriaId" required disabled={isPending}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        {categorias.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                                {cat.nombre}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
             <div>
                <Label htmlFor="descripcion">Descripción (Opcional)</Label>
                <Textarea id="descripcion" name="descripcion" placeholder="Ej: Cena con amigos" disabled={isPending} />
            </div>
             <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agregando...</> : 'Agregar Gasto'}
            </Button>
        </form>
    );
}
