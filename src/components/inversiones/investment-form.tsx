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
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
import { getStockPrices } from '@/ai/flows/stock-prices';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { searchStocks } from '@/ai/flows/stock-search';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface FinnhubCryptoSymbol {
    description: string;
    displaySymbol: string;
    symbol: string; // This is what we need, e.g., 'BINANCE:BTCUSDT'
}

interface StockSearchResult {
    symbol: string;
    name: string;
}

const InvestmentSchema = z.object({
    id: z.string().optional(),
    assetType: z.enum(['crypto', 'stock'], { required_error: 'Debes seleccionar un tipo de activo.' }),
    assetId: z.string().min(1, 'Debes seleccionar o ingresar un activo.'), // For stocks, this is the symbol. For crypto, it's the Finnhub symbol.
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
    const [finnhubCryptoSymbols, setFinnhubCryptoSymbols] = useState<FinnhubCryptoSymbol[]>([]);
    
    // States for crypto search
    const [cryptoSearchQuery, setCryptoSearchQuery] = useState('');
    const [cryptoSearchResults, setCryptoSearchResults] = useState<FinnhubCryptoSymbol[]>([]);
    const [isSearchingCrypto, setIsSearchingCrypto] = useState(false);
    const [selectedCoin, setSelectedCoin] = useState<FinnhubCryptoSymbol | null>(null);
    const [isCryptoListVisible, setIsCryptoListVisible] = useState(true);

    // States for stock search
    const [stockSearchQuery, setStockSearchQuery] = useState('');
    const [stockSearchResults, setStockSearchResults] = useState<StockSearchResult[]>([]);
    const [isSearchingStock, setIsSearchingStock] = useState(false);
    const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null);
    const [isStockListVisible, setIsStockListVisible] = useState(true);

    const { register, handleSubmit, formState: { errors }, control, reset, watch, setValue } = useForm<FormValues>({
        resolver: zodResolver(InvestmentSchema),
        defaultValues: {
            assetType: investment?.assetType || 'crypto',
            purchasePrice: investment?.purchasePrice || '',
        }
    });

    const assetType = watch('assetType');

    const fetchAllCryptoSymbols = useCallback(async () => {
        if (finnhubCryptoSymbols.length > 0) return; // Don't fetch if already loaded
        setIsLoading(true);
        try {
            const response = await fetch(`https://finnhub.io/api/v1/crypto/symbol?exchange=binance&token=${process.env.NEXT_PUBLIC_FINNHUB_API_KEY}`);
            if (!response.ok) throw new Error('Network response was not ok.');
            const data: FinnhubCryptoSymbol[] = await response.json();
            setFinnhubCryptoSymbols(data);
        } catch (error) {
            console.error("Failed to fetch all crypto symbols:", error);
            toast({ title: "Error", description: "No se pudieron cargar los símbolos de criptomonedas.", variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    }, [finnhubCryptoSymbols, toast]);
     
    // --- Crypto Search Logic (Local Filter) ---
    const searchCoins = useCallback((query: string) => {
        if (query.length < 2) {
            setCryptoSearchResults([]);
            return;
        }
        setIsSearchingCrypto(true);
        const filtered = finnhubCryptoSymbols.filter(coin => 
            coin.description.toLowerCase().includes(query.toLowerCase()) || 
            coin.symbol.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 50); // Limit results
        setCryptoSearchResults(filtered);
        setIsSearchingCrypto(false);
    }, [finnhubCryptoSymbols]);

    const debouncedCryptoSearch = useCallback(debounce(searchCoins, 300), [searchCoins]);

    // --- Stock Search Logic ---
    const searchStockSymbols = useCallback(async (query: string) => {
        if (query.length < 2) {
            setStockSearchResults([]);
            setIsSearchingStock(false);
            return;
        }
        setIsSearchingStock(true);
        try {
            const response = await searchStocks({ query });
            setStockSearchResults(response.results || []);
        } catch (error) {
            console.error("Failed to search stocks:", error);
            setStockSearchResults([]);
        } finally {
            setIsSearchingStock(false);
        }
    }, []);
    const debouncedStockSearch = useCallback(debounce(searchStockSymbols, 500), [searchStockSymbols]);

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
                setSelectedCoin({ symbol: investment.assetId, description: investment.name, displaySymbol: investment.symbol });
                setCryptoSearchQuery(investment.name);
                setIsCryptoListVisible(false);
            } else { 
                setSelectedStock({ symbol: investment.symbol, name: investment.name });
                setStockSearchQuery(investment.name);
                setIsStockListVisible(false);
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
            setCryptoSearchQuery('');
            setSelectedStock(null);
            setStockSearchQuery('');
        }
    }, [investment, reset]);

    useEffect(() => {
        // Reset search when asset type changes
        setValue('assetId', '');
        setSelectedCoin(null);
        setCryptoSearchQuery('');
        setCryptoSearchResults([]);
        setIsCryptoListVisible(true);

        setSelectedStock(null);
        setStockSearchQuery('');
        setStockSearchResults([]);
        setIsStockListVisible(true);

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
                        priceData = await getCryptoPrices({ symbols: [assetId] });
                        finalPurchasePrice = priceData[assetId]?.price || 0;
                    } else {
                        priceData = await getStockPrices({ symbols: [assetId.toUpperCase()] });
                        finalPurchasePrice = priceData[assetId.toUpperCase()]?.price || 0;
                    }
                    if(finalPurchasePrice === 0) {
                       toast({ title: 'Advertencia', description: 'No se pudo obtener el precio actual. Se guardará con precio 0.', variant: 'destructive'});
                    }
                } catch (apiError) {
                    console.error("API Error fetching price:", apiError);
                    toast({ title: 'Error de API', description: 'No se pudo obtener el precio actual. Se guardará con precio 0.', variant: 'destructive'});
                }
            }

            let name = '';
            let symbol = '';

            if (assetType === 'crypto') {
                if (!selectedCoin || selectedCoin.symbol !== assetId) throw new Error('Por favor selecciona una criptomoneda de la lista.');
                name = selectedCoin.description;
                symbol = selectedCoin.displaySymbol;
            } else { // Stock
                if (!selectedStock || selectedStock.symbol !== assetId) throw new Error('Por favor selecciona una acción de la lista.');
                name = selectedStock.name;
                symbol = selectedStock.symbol;
            }

            const dataToSave = { ...investmentData, assetType, assetId, name, symbol, purchasePrice: finalPurchasePrice, purchaseDate: investmentData.purchaseDate.getTime() };
            
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
                <Label htmlFor="assetId">Activo</Label>
                {assetType === 'crypto' ? (
                     <Command shouldFilter={false} className="relative overflow-visible">
                        <CommandInput 
                            placeholder="Busca por nombre o símbolo (ej: BTC)..."
                            value={cryptoSearchQuery}
                            onValueChange={(query) => {
                                setCryptoSearchQuery(query);
                                debouncedCryptoSearch(query);
                                if (!isCryptoListVisible) setIsCryptoListVisible(true);
                            }}
                             onFocus={() => { 
                                setIsCryptoListVisible(true); 
                                fetchAllCryptoSymbols();
                             }}
                        />
                        {isCryptoListVisible && (
                            <CommandList className="absolute top-10 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                                {(isLoading || isSearchingCrypto) && <CommandEmpty>Buscando...</CommandEmpty>}
                                {!isLoading && !isSearchingCrypto && cryptoSearchResults.length === 0 && cryptoSearchQuery.length > 1 && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
                                {cryptoSearchResults.length > 0 && (
                                <CommandGroup>
                                    {cryptoSearchResults.map((coin) => (
                                    <CommandItem
                                        key={coin.symbol}
                                        value={coin.symbol}
                                        onSelect={(currentValue) => {
                                            const selected = finnhubCryptoSymbols.find(c => c.symbol.toLowerCase() === currentValue.toLowerCase());
                                            if (selected) {
                                                setSelectedCoin(selected);
                                                setValue('assetId', selected.symbol);
                                                setCryptoSearchQuery(selected.description);
                                            }
                                            setIsCryptoListVisible(false);
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", (selectedCoin?.symbol === coin.symbol) ? "opacity-100" : "opacity-0")} />
                                        {coin.description} ({coin.displaySymbol})
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                                )}
                            </CommandList>
                        )}
                    </Command>
                ) : ( // Stock Search
                     <Command shouldFilter={false} className="relative overflow-visible">
                        <CommandInput 
                            placeholder="Busca por nombre o símbolo..."
                            value={stockSearchQuery}
                            onValueChange={(query) => {
                                setStockSearchQuery(query);
                                debouncedStockSearch(query);
                                if (!isStockListVisible) setIsStockListVisible(true);
                            }}
                             onFocus={() => setIsStockListVisible(true)}
                        />
                        {isStockListVisible && (
                            <CommandList className="absolute top-10 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                                {isSearchingStock && <CommandEmpty>Buscando...</CommandEmpty>}
                                {!isSearchingStock && stockSearchResults.length === 0 && stockSearchQuery.length > 1 && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
                                {stockSearchResults.length > 0 && (
                                <CommandGroup>
                                    {stockSearchResults.map((stock) => (
                                    <CommandItem
                                        key={stock.symbol}
                                        value={stock.symbol}
                                        onSelect={(currentValue) => {
                                            const selected = stockSearchResults.find(s => s.symbol.toLowerCase() === currentValue.toLowerCase());
                                            if (selected) {
                                                setSelectedStock(selected);
                                                setValue('assetId', selected.symbol);
                                                setStockSearchQuery(selected.name);
                                            }
                                            setIsStockListVisible(false);
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", (selectedStock?.symbol === stock.symbol) ? "opacity-100" : "opacity-0")} />
                                        {stock.name} ({stock.symbol.toUpperCase()})
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                                )}
                            </CommandList>
                        )}
                    </Command>
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
