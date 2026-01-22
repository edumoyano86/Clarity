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
import { CalendarIcon, Loader2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';
import { useFirestore } from '@/firebase';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { Investment } from '@/lib/definitions';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { searchStocks } from '@/ai/flows/stock-search';
import { searchCryptos } from '@/ai/flows/crypto-search';

interface StockSearchResult {
    symbol: string;
    name: string;
}

interface CryptoSearchResult {
    id: string; // coingecko id
    symbol: string; // e.g. btc
    name: string;
}

const InvestmentSchema = z.object({
    id: z.string().min(1, 'Debes buscar y seleccionar un activo de la lista.'),
    assetType: z.enum(['crypto', 'stock'], { required_error: 'Debes seleccionar un tipo de activo.' }),
    symbol: z.string().min(1, 'Símbolo del activo es requerido.'),
    name: z.string().min(1, 'El nombre del activo es requerido'),
    amount: z.coerce.number().positive('La cantidad debe ser un número positivo.'),
    purchaseDate: z.date({ required_error: 'La fecha de compra es requerida.' }),
    coinGeckoId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.assetType === 'crypto' && (!data.coinGeckoId || data.coinGeckoId.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['id'], // Attach error to the asset search field visually
            message: 'Para criptomonedas, el ID de CoinGecko es requerido. Por favor, vuelve a seleccionar el activo de la lista.',
        });
    }
});


type FormValues = z.infer<typeof InvestmentSchema>;

interface InvestmentFormProps {
    userId: string;
    investment?: Investment;
    onFormSuccess: () => void;
}

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced as (...args: Parameters<F>) => void;
}

export function InvestmentForm({ userId, investment, onFormSuccess }: InvestmentFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [stockResults, setStockResults] = useState<StockSearchResult[]>([]);
    const [cryptoResults, setCryptoResults] = useState<CryptoSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<StockSearchResult | CryptoSearchResult | null>(null);
    const [isListVisible, setIsListVisible] = useState(true);

    const { register, handleSubmit, formState: { errors }, control, reset, watch, setValue } = useForm<FormValues>({
        resolver: zodResolver(InvestmentSchema),
        defaultValues: {
            assetType: investment?.assetType || 'crypto',
        }
    });

    const assetType = watch('assetType');

    const searchAssets = useCallback(async (query: string) => {
        if (query.length < 1) {
            setStockResults([]);
            setCryptoResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            if (assetType === 'stock') {
                const response = await searchStocks({ query });
                setStockResults(response.results.filter(r => !r.symbol.includes(':') && !r.symbol.includes('.')) || []);
                setCryptoResults([]);
            } else {
                const response = await searchCryptos({ query });
                setCryptoResults(response.results || []);
                setStockResults([]);
            }
        } catch (error) {
            console.error("Failed to search assets:", error);
            toast({ title: 'Error de Búsqueda', description: 'No se pudieron obtener resultados.', variant: 'destructive'});
            setStockResults([]);
            setCryptoResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [assetType, toast]);

    const debouncedSearch = useCallback(debounce(searchAssets, 300), [searchAssets]);

    useEffect(() => {
        if (investment) {
            reset({
                id: investment.id,
                assetType: investment.assetType,
                symbol: investment.symbol,
                name: investment.name,
                amount: investment.amount,
                purchaseDate: new Date(investment.purchaseDate),
                coinGeckoId: investment.coinGeckoId,
            });
            setSelectedAsset({ symbol: investment.symbol, name: investment.name, id: investment.coinGeckoId || investment.id });
            setSearchQuery(investment.name);
            setIsListVisible(false);
        } else {
             reset({
                id: '',
                assetType: 'crypto',
                symbol: '',
                name: '',
                amount: undefined,
                purchaseDate: new Date(),
                coinGeckoId: '',
            });
            setSelectedAsset(null);
            setSearchQuery('');
        }
    }, [investment, reset]);

    useEffect(() => {
        if (!isListVisible) {
            setStockResults([]);
            setCryptoResults([]);
        }
    }, [isListVisible]);


    useEffect(() => {
        // When asset type changes, clear the selected asset
        setValue('id', '');
        setValue('symbol', '');
        setValue('name', '');
        setValue('coinGeckoId', '');
        setSelectedAsset(null);
        setSearchQuery('');
        setStockResults([]);
        setCryptoResults([]);
        setIsListVisible(true);
    }, [assetType, setValue]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const collectionRef = collection(firestore, 'users', userId, 'investments');
            
            let newDocId: string;
            if (data.assetType === 'crypto') {
                if (!data.coinGeckoId) throw new Error("El ID de CoinGecko es requerido para criptomonedas.");
                newDocId = data.coinGeckoId;
            } else {
                newDocId = (data.symbol || '').toUpperCase();
            }

            const dataToSave = {
                ...data,
                id: newDocId, // Ensure the final data has the correct ID
                purchaseDate: data.purchaseDate.getTime(),
            };

            await runTransaction(firestore, async (transaction) => {
                // If we are editing, AND the ID has changed, it means the user picked a different asset.
                // In this case, we must delete the old document to prevent orphans.
                if (investment && investment.id !== newDocId) {
                    const oldDocRef = doc(collectionRef, investment.id);
                    transaction.delete(oldDocRef);
                }

                const newDocRef = doc(collectionRef, newDocId);
                const newDocSnap = await transaction.get(newDocRef);

                if (newDocSnap.exists() && (!investment || investment.id !== newDocId)) { 
                    // This condition handles:
                    // 1. Adding to an existing position when CREATING a new investment.
                    // 2. Editing an investment and changing it to ANOTHER existing asset.
                    const existingData = newDocSnap.data() as Investment;
                    const newAmount = existingData.amount + data.amount;
                    
                    const weightedPurchaseDate = Math.round(
                        (existingData.purchaseDate * existingData.amount + data.purchaseDate.getTime() * data.amount) / newAmount
                    );

                    transaction.update(newDocRef, { 
                        amount: newAmount, 
                        purchaseDate: weightedPurchaseDate 
                    });

                } else { 
                    // This handles:
                    // 1. Creating a brand new investment.
                    // 2. Editing an existing investment (and not changing the asset).
                    transaction.set(newDocRef, dataToSave, { merge: true });
                }
            });

            toast({ title: 'Éxito', description: 'Inversión guardada exitosamente.'});
            onFormSuccess();
        } catch (error) {
             console.error("Error saving investment:", error);
            toast({ title: 'Error', description: (error as Error).message || 'No se pudo guardar la inversión.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const renderResults = () => {
        const handleSelect = (asset: StockSearchResult | CryptoSearchResult) => {
            if ('symbol' in asset && assetType === 'stock') {
                const upperCaseSymbol = asset.symbol.toUpperCase();
                setSelectedAsset({ ...asset, id: upperCaseSymbol });
                setValue('id', upperCaseSymbol);
                setValue('symbol', upperCaseSymbol);
                setValue('name', asset.name);
                setValue('coinGeckoId', '');
                setSearchQuery(asset.name);
            } else if ('id' in asset && assetType === 'crypto') {
                const cryptoAsset = asset as CryptoSearchResult;
                const upperCaseSymbol = cryptoAsset.symbol.toUpperCase();
                setSelectedAsset(cryptoAsset);
                setValue('id', cryptoAsset.id);
                setValue('symbol', upperCaseSymbol);
                setValue('name', cryptoAsset.name);
                setValue('coinGeckoId', cryptoAsset.id);
                setSearchQuery(cryptoAsset.name);
            }
            setIsListVisible(false);
        };
        
        const results = assetType === 'stock' ? stockResults : cryptoResults;

        return results.map((asset) => (
            <CommandItem
                key={(asset as any).id || (asset as any).symbol}
                value={asset.name}
                onSelect={() => handleSelect(asset)}
            >
                <Check className={cn("mr-2 h-4 w-4", selectedAsset?.name === asset.name ? "opacity-100" : "opacity-0")} />
                {asset.name} ({(asset.symbol || '').toUpperCase()})
            </CommandItem>
        ));
    }


    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            <Controller
                name="assetType"
                control={control}
                render={({ field }) => (
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                        <div>
                            <RadioGroupItem value="crypto" id="crypto" className="peer sr-only" />
                            <Label htmlFor="crypto" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Criptomoneda</Label>
                        </div>
                        <div>
                            <RadioGroupItem value="stock" id="stock" className="peer sr-only" />
                             <Label htmlFor="stock" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">Acción</Label>
                        </div>
                    </RadioGroup>
                )}
            />

            <div>
                <Label htmlFor="symbol">Activo</Label>
                 <Command shouldFilter={false} className="relative overflow-visible">
                    <CommandInput 
                        placeholder={assetType === 'crypto' ? "Busca cripto (ej: bitcoin)..." : "Busca acción (ej: AAPL)..."}
                        value={searchQuery}
                        onValueChange={(query) => {
                            setSearchQuery(query);
                            debouncedSearch(query);
                            if (!isListVisible) setIsListVisible(true);
                        }}
                        onFocus={() => setIsListVisible(true)}
                    />
                    {isListVisible && (
                        <CommandList className="absolute top-10 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                            {isSearching && <CommandEmpty>Buscando...</CommandEmpty>}
                            {!isSearching && stockResults.length === 0 && cryptoResults.length === 0 && searchQuery.length > 1 && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
                            {(stockResults.length > 0 || cryptoResults.length > 0) && (
                                <CommandGroup>
                                    {renderResults()}
                                </CommandGroup>
                            )}
                        </CommandList>
                    )}
                </Command>
                {errors.id && <p className="text-sm text-destructive">{errors.id.message}</p>}
                 {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                 {errors.symbol && <p className="text-sm text-destructive">{errors.symbol.message}</p>}
            </div>
            
            <div>
                <Label htmlFor="amount">Cantidad</Label>
                <Input id="amount" type="number" step="any" placeholder="Ej: 0.5" {...register('amount')} />
                 {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>

             <div>
                <Label htmlFor="purchaseDate">Fecha de Compra</Label>
                <Controller
                    name="purchaseDate"
                    control={control}
                    render={({ field }) => (
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es}/>
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
