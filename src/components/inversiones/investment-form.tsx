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
import { collection, doc, setDoc } from 'firebase/firestore';
import { Investment } from '@/lib/definitions';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { searchStocks } from '@/ai/flows/stock-search';
import { searchCryptos } from '@/ai/flows/crypto-search';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
    id: z.string().min(1, 'Debes seleccionar un activo válido de la lista.'),
    assetType: z.enum(['crypto', 'stock'], { required_error: 'Debes seleccionar un tipo de activo.' }),
    symbol: z.string().min(1, 'Debes seleccionar un activo.'),
    name: z.string().min(1, 'El nombre del activo es requerido'),
    amount: z.coerce.number().positive('La cantidad debe ser un número positivo.'),
    purchaseDate: z.date({ required_error: 'La fecha de compra es requerida.' }),
    coinGeckoId: z.string().optional(),
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
            if (!selectedAsset && !investment) {
                 toast({ title: 'Error', description: 'Por favor selecciona un activo válido de la lista.', variant: 'destructive' });
                 setIsLoading(false);
                 return;
            }
            
            const collectionRef = collection(firestore, 'users', userId, 'investments');
            
            let docId: string;
            // For cryptos, the document ID is the coinGeckoId. For stocks, it's the symbol.
            if (data.assetType === 'crypto') {
                if (!data.coinGeckoId) {
                    throw new Error("El ID de CoinGecko es requerido para criptomonedas.");
                }
                docId = data.coinGeckoId;
            } else {
                docId = data.symbol.toUpperCase();
            }

            // The `id` field within the document should match the document's ID in Firestore.
            data.id = docId;

            const dataToSave = {
                ...data,
                purchaseDate: data.purchaseDate.getTime(),
            };

            const docRef = doc(collectionRef, docId);

            setDoc(docRef, dataToSave, { merge: true }).catch(serverError => {
                const operation = investment ? 'update' : 'create';
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation, requestResourceData: dataToSave, }));
                throw serverError;
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
        if (assetType === 'stock') {
            return stockResults.map((asset) => (
                <CommandItem
                    key={asset.symbol}
                    value={asset.name}
                    onSelect={() => {
                        const upperCaseSymbol = asset.symbol.toUpperCase();
                        setSelectedAsset({ ...asset, id: upperCaseSymbol });
                        setValue('id', upperCaseSymbol);
                        setValue('symbol', upperCaseSymbol);
                        setValue('name', asset.name);
                        setValue('coinGeckoId', ''); // Stocks don't have this
                        setSearchQuery(asset.name);
                        setIsListVisible(false);
                    }}
                >
                    <Check className={cn("mr-2 h-4 w-4", (selectedAsset?.symbol === asset.symbol) ? "opacity-100" : "opacity-0")} />
                    {asset.name} ({asset.symbol.toUpperCase()})
                </CommandItem>
            ))
        }
        if (assetType === 'crypto') {
            return cryptoResults.map((asset) => (
                 <CommandItem
                    key={asset.id}
                    value={asset.name} 
                    onSelect={() => {
                        const upperCaseSymbol = asset.symbol.toUpperCase();
                        setSelectedAsset(asset);
                        setValue('id', asset.id); // Set the main ID to coingecko ID
                        setValue('symbol', upperCaseSymbol);
                        setValue('name', asset.name);
                        setValue('coinGeckoId', asset.id); // Also set the specific coingecko ID field
                        setSearchQuery(asset.name);
                        setIsListVisible(false);
                    }}
                >
                    <Check className={cn("mr-2 h-4 w-4", ((selectedAsset as CryptoSearchResult)?.id === asset.id) ? "opacity-100" : "opacity-0")} />
                    {asset.name} ({asset.symbol.toUpperCase()})
                </CommandItem>
            ))
        }
        return null;
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            {!investment && (
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
            )}

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
                        disabled={!!investment}
                    />
                    {isListVisible && !investment && (
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
