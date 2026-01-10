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
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Investment } from '@/lib/definitions';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { searchStocks } from '@/ai/flows/stock-search';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface SearchResult {
    symbol: string;
    name: string;
}

const InvestmentSchema = z.object({
    id: z.string().optional(),
    assetType: z.enum(['crypto', 'stock'], { required_error: 'Debes seleccionar un tipo de activo.' }),
    symbol: z.string().min(1, 'Debes seleccionar o ingresar un activo.'),
    name: z.string().min(1, 'El nombre del activo es requerido'),
    amount: z.coerce.number().positive('La cantidad debe ser un número positivo.'),
    purchaseDate: z.date({ required_error: 'La fecha de compra es requerida.' }),
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
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<SearchResult | null>(null);
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
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            // Unified search for both stocks and crypto
            const response = await searchStocks({ query });
            
            // Filter results based on the selected assetType
            let filteredResults = response.results || [];
            if (assetType === 'crypto') {
                // For crypto, symbols often contain a colon, like 'BINANCE:BTCUSDT'
                filteredResults = filteredResults.filter(r => r.symbol.includes(':'));
            } else {
                // For stocks, filter out anything that looks like a crypto or has weird characters
                filteredResults = filteredResults.filter(r => !r.symbol.includes(':') && !r.symbol.includes('.'));
            }
            setSearchResults(filteredResults);

        } catch (error) {
            console.error("Failed to search assets:", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [assetType]);

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
            });
            setSelectedAsset({ symbol: investment.symbol, name: investment.name });
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
            });
            setSelectedAsset(null);
            setSearchQuery('');
        }
    }, [investment, reset]);

    useEffect(() => {
        setValue('symbol', '');
        setValue('name', '');
        setSelectedAsset(null);
        setSearchQuery('');
        setSearchResults([]);
        setIsListVisible(true);
    }, [assetType, setValue]);

    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        setIsLoading(true);
        try {
            const { id, ...investmentData } = data;
            
            if (!selectedAsset || selectedAsset.symbol !== data.symbol) {
                 toast({ title: 'Error', description: 'Por favor selecciona un activo válido de la lista.', variant: 'destructive' });
                 setIsLoading(false);
                 return;
            }

            const dataToSave = { 
                assetType: investmentData.assetType,
                symbol: investmentData.symbol,
                name: investmentData.name,
                amount: investmentData.amount,
                purchaseDate: investmentData.purchaseDate.getTime() 
            };
            
            const collectionRef = collection(firestore, 'users', userId, 'investments');
            
            if (id) {
                const docRef = doc(collectionRef, id);
                setDoc(docRef, dataToSave, { merge: true }).catch(serverError => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: dataToSave, }));
                    throw serverError;
                });
            } else {
                addDoc(collectionRef, dataToSave).catch(serverError => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: collectionRef.path, operation: 'create', requestResourceData: dataToSave, }));
                    throw serverError;
                });
            }

            toast({ title: 'Éxito', description: 'Inversión guardada exitosamente.'});
            onFormSuccess();
        } catch (error) {
             console.error("Error saving investment:", error);
            toast({ title: 'Error', description: (error as Error).message || 'No se pudo guardar la inversión.', variant: 'destructive' });
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
                        placeholder={assetType === 'crypto' ? "Busca cripto (ej: BTC)..." : "Busca acción (ej: AAPL)..."}
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
                            {!isSearching && searchResults.length === 0 && searchQuery.length > 1 && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
                            {searchResults.length > 0 && (
                            <CommandGroup>
                                {searchResults.map((asset) => (
                                <CommandItem
                                    key={asset.symbol}
                                    value={asset.symbol}
                                    onSelect={(currentValue) => {
                                        const selected = searchResults.find(s => s.symbol.toLowerCase() === currentValue.toLowerCase());
                                        if (selected) {
                                            setSelectedAsset(selected);
                                            setValue('symbol', selected.symbol);
                                            setValue('name', selected.name);
                                            setSearchQuery(selected.name);
                                        }
                                        setIsListVisible(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", (selectedAsset?.symbol === asset.symbol) ? "opacity-100" : "opacity-0")} />
                                    {asset.name} ({asset.symbol.toUpperCase()})
                                </CommandItem>
                                ))}
                            </CommandGroup>
                            )}
                        </CommandList>
                    )}
                </Command>
                {errors.symbol && <p className="text-sm text-destructive">{errors.symbol.message}</p>}
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
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es} />
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
