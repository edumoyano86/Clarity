'use client';

import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Categoria, Gasto } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';
import { useFirestore } from '@/firebase';
import { collection, addDoc, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { generateBudgetAlert } from '@/ai/flows/budget-alerts';

const GastoSchema = z.object({
  id: z.string().optional(),
  notes: z.string().optional(),
  amount: z.coerce.number({ invalid_type_error: 'La cantidad debe ser un número.'}).positive('La cantidad debe ser un número positivo'),
  categoryId: z.string({ required_error: 'La categoría es requerida.'}).min(1, 'La categoría es requerida'),
  date: z.date({ required_error: 'La fecha es requerida.'}),
});

type FormValues = z.infer<typeof GastoSchema>;

interface ExpenseFormProps {
    categorias: Categoria[];
    userId: string;
    expense?: Gasto;
    onFormSuccess: () => void;
}

export function ExpenseForm({ categorias, userId, expense, onFormSuccess }: ExpenseFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    
    const { register, handleSubmit, formState: { errors }, control, reset } = useForm<FormValues>({
        resolver: zodResolver(GastoSchema),
    });

    useEffect(() => {
        if (expense) {
            reset({
                id: expense.id,
                notes: expense.notes || '',
                amount: expense.amount,
                categoryId: expense.categoryId,
                date: new Date(expense.date),
            });
        } else {
            reset({
                id: '',
                notes: '',
                amount: undefined,
                categoryId: '',
                date: new Date(),
            });
        }
    }, [expense, reset]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        if (!firestore) {
            toast({ title: 'Error', description: 'Firestore no está disponible', variant: 'destructive'});
            setIsLoading(false);
            return;
        }

        try {
            const { id, ...gastoData } = data;
            const dataToSave = {
                ...gastoData,
                date: gastoData.date.getTime(),
            };
            const expensesColRef = collection(firestore, "users", userId, "expenses");
            
            if (id) {
                await setDoc(doc(expensesColRef, id), dataToSave, { merge: true });
            } else {
                await addDoc(expensesColRef, dataToSave);
            }

            toast({
                title: 'Éxito',
                description: 'Gasto guardado exitosamente.',
            });

            // Check budget
            const catDocRef = doc(firestore, "users", userId, "expenseCategories", data.categoryId);
            const categoriaDoc = await getDoc(catDocRef);
            
            if (!categoriaDoc.exists()) {
                onFormSuccess();
                return;
            };

            const categoria = categoriaDoc.data() as Categoria;
            
            if (categoria && categoria.budget && categoria.budget > 0) {
                const q = query(expensesColRef, where("categoryId", "==", data.categoryId));
                const gastosSnap = await getDocs(q);
                const totalGastado = gastosSnap.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

                if (totalGastado > categoria.budget) {
                    try {
                        const alertResult = await generateBudgetAlert({
                            category: categoria.name,
                            spentAmount: totalGastado,
                            budgetLimit: categoria.budget,
                            userName: 'Usuario',
                        });
                        toast({
                            title: 'Alerta de Presupuesto',
                            description: alertResult.alertMessage,
                            variant: 'destructive',
                            duration: 10000,
                        });
                    } catch (error) {
                        console.error("Error generating budget alert:", error);
                    }
                }
            }
            onFormSuccess();

        } catch (error) {
            console.error("Error saving expense:", error);
            toast({
                title: 'Error',
                description: 'No se pudo guardar el gasto.',
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
                <Label htmlFor="amount">Cantidad</Label>
                <Input id="amount" type="number" step="0.01" placeholder="Ej: 45.50" {...register('amount')} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div>
                <Label htmlFor="categoryId">Categoría</Label>
                 <Controller
                    name="categoryId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {categorias.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                 />
                {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
            </div>
            <div>
                <Label htmlFor="date">Fecha</Label>
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
                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
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
                            </PopoverContent>
                        </Popover>
                    )}
                />
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
             <div>
                <Label htmlFor="notes">Descripción (Opcional)</Label>
                <Textarea id="notes" placeholder="Ej: Cena con amigos" {...register('notes')}/>
            </div>
             <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Gasto'}
            </Button>
        </form>
    );
}
