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
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Investment } from '@/lib/definitions';

// For simplicity, we'll hardcode a list of popular coins.
// In a real app, this could be fetched from CoinGecko API.
const popularCoins = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { id: 'tether', symbol: 'USDT', name: 'Tether' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
    { id: 'solana', symbol: 'SOL', name: 'Solana' },
    { id: 'usd-coin', symbol: 'USDC', name: 'USDC' },
    { id: 'ripple', symbol: 'XRP', name: 'XRP' },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
    { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu' },
];

const InvestmentSchema = z.object({
    id: z.string().optional(),
    coinId: z.string({ required_error: 'Debes seleccionar una criptomoneda.' }),
    amount: z.coerce.number().positive('La cantidad debe ser un número positivo.'),
    purchasePrice: z.coerce.number().positive('El precio debe ser un número positivo.'),
    purchaseDate: z.date({ required_error: 'La fecha de compra es requerida.' }),
});

type FormValues = z.infer<typeof InvestmentSchema>;

interface InvestmentFormProps {
    userId: string;
    investment?: Investment;
    onFormSuccess: () => void;
}

export function InvestmentForm({ userId, investment, onFormSuccess }: InvestmentFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    
    const { register, handleSubmit, formState: { errors }, control, reset } = useForm<FormValues>({
        resolver: zodResolver(InvestmentSchema),
    });

    useEffect(() => {
        if (investment) {
            reset({
                id: investment.id,
                coinId: investment.coinId,
                amount: investment.amount,
                purchasePrice: investment.purchasePrice,
                purchaseDate: new Date(investment.purchaseDate),
            });
        } else {
             reset({
                id: '',
                coinId: undefined,
                amount: undefined,
                purchasePrice: undefined,
                purchaseDate: new Date(),
            });
        }
    }, [investment, reset]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const { id, coinId, ...investmentData } = data;
            const selectedCoin = popularCoins.find(c => c.id === coinId);

            if (!selectedCoin) {
                toast({ title: 'Error', description: 'Criptomoneda no válida.', variant: 'destructive' });
                setIsLoading(false);
                return;
            }

            const dataToSave = {
                ...investmentData,
                coinId: selectedCoin.id,
                name: selectedCoin.name,
                symbol: selectedCoin.symbol,
                purchaseDate: investmentData.purchaseDate.getTime(),
            };
            
            const collectionRef = collection(firestore, 'users', userId, 'investments');

            if (id) {
                await setDoc(doc(collectionRef, id), dataToSave, { merge: true });
            } else {
                await addDoc(collectionRef, dataToSave);
            }

            toast({
                title: 'Éxito',
                description: 'Inversión guardada exitosamente.',
            });
            onFormSuccess();
        } catch (error) {
             console.error("Error saving investment:", error);
            toast({
                title: 'Error',
                description: 'No se pudo guardar la inversión.',
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
                <Label htmlFor="coinId">Criptomoneda</Label>
                 <Controller
                    name="coinId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un activo" />
                            </SelectTrigger>
                            <SelectContent>
                                {popularCoins.map(coin => (
                                    <SelectItem key={coin.id} value={coin.id}>
                                        {coin.name} ({coin.symbol.toUpperCase()})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {errors.coinId && <p className="text-sm text-destructive">{errors.coinId.message}</p>}
            </div>
            <div>
                <Label htmlFor="amount">Cantidad</Label>
                <Input id="amount" type="number" step="any" placeholder="Ej: 0.5" {...register('amount')} />
                 {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div>
                <Label htmlFor="purchasePrice">Precio de Compra (por unidad, en USD)</Label>
                <Input id="purchasePrice" type="number" step="any" placeholder="Ej: 60000.00" {...register('purchasePrice')} />
                 {errors.purchasePrice && <p className="text-sm text-destructive">{errors.purchasePrice.message}</p>}
            </div>
             <div>
                <Label htmlFor="purchaseDate">Fecha de Compra</Label>
                <Controller
                    name="purchaseDate"
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
                {errors.purchaseDate && <p className="text-sm text-destructive">{errors.purchaseDate.message}</p>}
            </div>
             <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar Inversión'}
            </Button>
        </form>
    );
}
