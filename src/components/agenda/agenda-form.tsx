'use client';

import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Appointment } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Loader2, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Textarea } from '../ui/textarea';

const AppointmentSchema = z.object({
  id: z.string().optional(),
  title: z.string({ required_error: 'El título es requerido.' }).min(1, 'El título es requerido'),
  date: z.date({ required_error: 'La fecha es requerida.' }),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof AppointmentSchema>;

interface AgendaFormProps {
    userId: string;
    appointment?: Appointment;
    onFormSuccess: () => void;
}

export function AgendaForm({ userId, appointment, onFormSuccess }: AgendaFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, formState: { errors }, control, reset } = useForm<FormValues>({
        resolver: zodResolver(AppointmentSchema),
    });

    useEffect(() => {
        if (appointment) {
            reset({
                id: appointment.id,
                title: appointment.title,
                date: new Date(appointment.date),
                notes: appointment.notes || '',
            });
        } else {
            reset({
                id: '',
                title: '',
                date: new Date(),
                notes: '',
            });
        }
    }, [appointment, reset]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const { id, ...appointmentData } = data;
            const dataToSave = {
                ...appointmentData,
                date: appointmentData.date.getTime(),
                userId: userId,
            };

            const collectionRef = collection(firestore, 'users', userId, 'appointments');

            if (id) {
                await setDoc(doc(collectionRef, id), dataToSave, { merge: true });
            } else {
                await addDoc(collectionRef, dataToSave);
            }

            toast({
                title: 'Éxito',
                description: 'Cita guardada exitosamente.',
            });
            onFormSuccess();
        } catch (error) {
            console.error("Error saving appointment:", error);
            toast({
                title: 'Error',
                description: 'No se pudo guardar la cita.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
             <input type="hidden" {...register('id')} />
            <div>
                <Label htmlFor="title">Título</Label>
                <Input id="title" {...register('title')} />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>
            <div>
                <Label htmlFor="date">Fecha y Hora</Label>
                <Controller
                    name="date"
                    control={control}
                    render={({ field }) => (
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP p", { locale: es }) : <span>Selecciona una fecha</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                    locale={es}
                                    />
                                {/* Simple time picker */}
                                <div className="p-2 border-t">
                                    <Input type="time" 
                                        defaultValue={field.value ? format(field.value, 'HH:mm') : ''}
                                        onChange={(e) => {
                                            const time = e.target.value;
                                            const [hours, minutes] = time.split(':').map(Number);
                                            const newDate = new Date(field.value || new Date());
                                            newDate.setHours(hours, minutes);
                                            field.onChange(newDate);
                                        }}
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                />
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
            <div>
                <Label htmlFor="notes">Notas (Opcional)</Label>
                <Textarea id="notes" {...register('notes')} />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Cita'}
            </Button>
        </form>
    );
}
