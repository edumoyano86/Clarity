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
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
import { getStockPrices } from '@/ai/flows/stock-prices';

const popularCoins = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { id: 'tether', symbol: 'USDT', name: 'Tether' },
    { id: 'binancecoin', symbol: 'BNB', name: 'Binance Coin' },
    { id: 'solana', symbol: 'SOL', name: 'Solana' },
    { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
    { id: 'ripple', symbol: 'XRP', name: 'XRP' },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
    { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu' },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
    { id: 'tron', symbol: 'TRX', name: 'TRON' },
    { id: 'matic-network', symbol: 'MATIC', name: 'Polygon' },
    { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
    { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
    { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos Hub' },
    { id: 'terra-luna-2', symbol: 'LUNA', name: 'Terra 2.0'},
    { id: 'terra-classic-usd', symbol: 'USTC', name: 'TerraClassicUSD' }
];


const InvestmentSchema = z.object({
    id: z.string().optional(),
    assetType: z.enum(['crypto', 'stock'], { required_error: 'Debes seleccionar un tipo de activo.' }),
    assetId: z.string().min(1, 'Debes seleccionar o ingresar un activo.'),
    amount: z.coerce.number().positive('La cantidad debe ser un número positivo.'),
    purchasePrice: z.coerce.number().positive('El precio debe ser un número positivo.').optional().or(z.literal('')),
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
    
    const { register, handleSubmit, formState: { errors }, control, reset, watch, setValue } = useForm<FormValues>({
        resolver: zodResolver(InvestmentSchema),
        defaultValues: {
            assetType: investment?.assetType || 'crypto',
            purchasePrice: investment?.purchasePrice || '',
        }
    });

    const assetType = watch('assetType');

    useEffect(() => {
        if (investment) {
            reset({
                id: investment.id,
                assetType: investment.assetType,
                assetId: investment.assetId,
                amount: investment.amount,
                purchasePrice: investment.purchasePrice,
                purchaseDate: new Date(investment.purchaseDate),
            });
        } else {
             reset({
                id: '',
                assetType: 'crypto',
                assetId: '',
                amount: undefined,
                purchasePrice: '',
                purchaseDate: new Date(),
            });
        }
    }, [investment, reset]);

    useEffect(() => {
        setValue('assetId', '');
    }, [assetType, setValue]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const { id, assetId, assetType, ...investmentData } = data;
            
            let finalPurchasePrice = investmentData.purchasePrice ? Number(investmentData.purchasePrice) : 0;

            // If purchase price is not provided, fetch it
            if (!finalPurchasePrice) {
                try {
                    let priceData;
                    if (assetType === 'crypto') {
                        priceData = await getCryptoPrices({ assetIds: [assetId] });
                        finalPurchasePrice = priceData[assetId]?.price || 0;
                    } else {
                        priceData = await getStockPrices({ symbols: [assetId.toUpperCase()] });
                        finalPurchasePrice = priceData[assetId.toUpperCase()]?.price || 0;
                    }

                    if(finalPurchasePrice === 0) {
                       toast({
                            title: 'Advertencia',
                            description: 'No se pudo obtener el precio actual. Se guardará con precio 0.',
                            variant: 'destructive'
                       });
                    }

                } catch (apiError) {
                    console.error("API Error fetching price:", apiError);
                    toast({
                        title: 'Error de API',
                        description: 'No se pudo obtener el precio actual. Se guardará con precio 0.',
                        variant: 'destructive',
                    });
                }
            }


            let name = '';
            let symbol = '';

            if (assetType === 'crypto') {
                const selectedCoin = popularCoins.find(c => c.id === assetId);
                if (!selectedCoin) throw new Error('Criptomoneda no válida');
                name = selectedCoin.name;
                symbol = selectedCoin.symbol;
            } else { // stock
                // For stocks, we use the ticker symbol as name/symbol and assetId
                name = assetId.toUpperCase();
                symbol = assetId.toUpperCase();
            }

            const dataToSave = {
                ...investmentData,
                assetType,
                assetId,
                name,
                symbol,
                purchasePrice: finalPurchasePrice,
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

            <Controller
                name="assetType"
                control={control}
                render={({ field }) => (
                    <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 gap-4"
                        >
                        <div>
                            <RadioGroupItem value="crypto" id="crypto" className="peer sr-only" />
                            <Label htmlFor="crypto" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Criptomoneda
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="stock" id="stock" className="peer sr-only" />
                             <Label htmlFor="stock" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Acción
                            </Label>
                        </div>
                    </RadioGroup>
                )}
            />

            <div>
                <Label htmlFor="assetId">Activo</Label>
                {assetType === 'crypto' ? (
                     <Controller
                        name="assetId"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una criptomoneda" />
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
                ) : (
                    <Input id="assetId" placeholder="Ej: AAPL, GOOGL" {...register('assetId')} />
                )}
                {errors.assetId && <p className="text-sm text-destructive">{errors.assetId.message}</p>}
            </div>
            
            <div>
                <Label htmlFor="amount">Cantidad</Label>
                <Input id="amount" type="number" step="any" placeholder="Ej: 0.5" {...register('amount')} />
                 {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div>
                <Label htmlFor="purchasePrice">Precio de Compra (por unidad, en USD) - Opcional</Label>
                <Input id="purchasePrice" type="number" step="any" placeholder="Dejar vacío para usar precio actual" {...register('purchasePrice')} />
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
