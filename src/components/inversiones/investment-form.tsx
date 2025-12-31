'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Investment } from '@/lib/definitions';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
import { getStockPrices } from '@/ai/flows/stock-prices';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';

interface CoinGeckoCoin {
    id: string;
    symbol: string;
    name: string;
}

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

// Helper function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced as (...args: Parameters<F>) => void;
}


export function InvestmentForm({ userId, investment, onFormSuccess }: InvestmentFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<CoinGeckoCoin[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedCoin, setSelectedCoin] = useState<CoinGeckoCoin | null>(null);
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { register, handleSubmit, formState: { errors }, control, reset, watch, setValue } = useForm<FormValues>({
        resolver: zodResolver(InvestmentSchema),
        defaultValues: {
            assetType: investment?.assetType || 'crypto',
            purchasePrice: investment?.purchasePrice || '',
        }
    });

    const assetType = watch('assetType');
    
     const debouncedSearch = useCallback(
        debounce(async (query: string) => {
            if (query.length < 2) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }
            setIsSearching(true);
            try {
                const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${query}`);
                if (!response.ok) throw new Error('Network response was not ok.');
                const data = await response.json();
                setSearchResults(data.coins || []);
            } catch (error) {
                console.error("Failed to search coins:", error);
                toast({
                    title: 'Error de Búsqueda',
                    description: 'No se pudieron buscar las criptomonedas.',
                    variant: 'destructive',
                });
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300), 
    [toast]);


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
            if(investment.assetType === 'crypto') {
                setSelectedCoin({ id: investment.assetId, name: investment.name, symbol: investment.symbol });
            }
        } else {
             reset({
                id: '',
                assetType: 'crypto',
                assetId: '',
                amount: undefined,
                purchasePrice: '',
                purchaseDate: new Date(),
            });
            setSelectedCoin(null);
        }
    }, [investment, reset]);

    useEffect(() => {
        setValue('assetId', '');
        setSelectedCoin(null);
        setSearchQuery('');
        setSearchResults([]);
    }, [assetType, setValue]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const { id, assetId, assetType, ...investmentData } = data;
            
            let finalPurchasePrice = investmentData.purchasePrice ? Number(investmentData.purchasePrice) : 0;

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
                if (!selectedCoin || selectedCoin.id !== assetId) throw new Error('Por favor selecciona una criptomoneda de la lista.');
                name = selectedCoin.name;
                symbol = selectedCoin.symbol;
            } else {
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
                description: (error as Error).message || 'No se pudo guardar la inversión.',
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
                            <Popover open={open} onOpenChange={setOpen} modal={true}>
                                <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full justify-between"
                                >
                                    {selectedCoin
                                    ? selectedCoin.name
                                    : "Busca una criptomoneda..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput 
                                            placeholder="Busca por nombre o símbolo..."
                                            value={searchQuery}
                                            onValueChange={(query) => {
                                                setSearchQuery(query);
                                                debouncedSearch(query);
                                            }}
                                        />
                                        <CommandList>
                                            {isSearching && <CommandEmpty>Buscando...</CommandEmpty>}
                                            {!isSearching && searchQuery.length > 1 && searchResults.length === 0 && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
                                            <CommandGroup>
                                                {searchResults.map((coin) => (
                                                <CommandItem
                                                    key={coin.id}
                                                    value={coin.id}
                                                    onSelect={(currentValue) => {
                                                        const selected = searchResults.find(c => c.id === currentValue);
                                                        if (selected) {
                                                            setSelectedCoin(selected);
                                                            field.onChange(selected.id);
                                                        }
                                                        setOpen(false)
                                                    }}
                                                >
                                                    <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        field.value === coin.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                    />
                                                    {coin.name} ({coin.symbol.toUpperCase()})
                                                </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
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
