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
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';
import { useFirestore } from '@/firebase';
import { collection, doc, runTransaction, DocumentReference } from 'firebase/firestore';
import { Investment } from '@/lib/definitions';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { AssetSearchCombobox, type AssetSearchResult, type CryptoSearchResult, type StockSearchResult } from './asset-search-combobox';


const InvestmentSchema = z.object({
    id: z.string().optional(),
    assetType: z.enum(['crypto', 'stock'], { required_error: 'Debes seleccionar un tipo de activo.' }),
    symbol: z.string().min(1, 'Símbolo del activo es requerido.'),
    name: z.string().min(1, 'El nombre del activo es requerido'),
    amount: z.coerce.number().positive('La cantidad debe ser un número positivo.'),
    purchaseDate: z.date({ required_error: 'La fecha de compra es requerida.' }),
    coinGeckoId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (!data.id) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['id'],
            message: 'Debes buscar y seleccionar un activo de la lista.',
        });
    }
    if (data.assetType === 'crypto' && (!data.coinGeckoId || data.coinGeckoId.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['id'],
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

export function InvestmentForm({ userId, investment, onFormSuccess }: InvestmentFormProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null);

    const { register, handleSubmit, formState: { errors }, control, reset, watch, setValue } = useForm<FormValues>({
        resolver: zodResolver(InvestmentSchema),
        defaultValues: {
            assetType: investment?.assetType || 'crypto',
        }
    });

    const assetType = watch('assetType');

    useEffect(() => {
        if (investment) {
            const initialAsset: AssetSearchResult = { 
                symbol: investment.symbol, 
                name: investment.name, 
                id: investment.assetType === 'crypto' ? (investment.coinGeckoId || '') : investment.symbol
            };
            reset({
                id: investment.id,
                assetType: investment.assetType,
                symbol: investment.symbol,
                name: investment.name,
                amount: investment.amount,
                purchaseDate: new Date(investment.purchaseDate),
                coinGeckoId: investment.coinGeckoId,
            });
            setSelectedAsset(initialAsset);
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
        }
    }, [investment, reset]);

    useEffect(() => {
        if (!investment) {
            handleSelectAsset(null);
        }
    }, [assetType, investment]);


    const handleSelectAsset = useCallback((asset: AssetSearchResult | null) => {
        setSelectedAsset(asset); 
        if (asset) {
            if ('symbol' in asset && assetType === 'stock') {
                const stockAsset = asset as StockSearchResult;
                const upperCaseSymbol = stockAsset.symbol.toUpperCase();
                setValue('id', upperCaseSymbol, { shouldValidate: true });
                setValue('symbol', upperCaseSymbol);
                setValue('name', stockAsset.name);
                setValue('coinGeckoId', '');
            } else if ('id' in asset && assetType === 'crypto') {
                const cryptoAsset = asset as CryptoSearchResult;
                const upperCaseSymbol = cryptoAsset.symbol.toUpperCase();
                setValue('id', cryptoAsset.id, { shouldValidate: true });
                setValue('symbol', upperCaseSymbol);
                setValue('name', cryptoAsset.name);
                setValue('coinGeckoId', cryptoAsset.id, { shouldValidate: true });
            }
        } else {
            setValue('id', '', { shouldValidate: true });
            setValue('symbol', '');
            setValue('name', '');
            setValue('coinGeckoId', '');
        }
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
                id: newDocId,
                purchaseDate: data.purchaseDate.getTime(),
            };

            await runTransaction(firestore, async (transaction) => {
                const newDocRef = doc(collectionRef, newDocId);
                let oldDocRef: DocumentReference | undefined;
                
                if (investment && investment.id !== newDocId) {
                    oldDocRef = doc(collectionRef, investment.id);
                }

                const newDocSnap = await transaction.get(newDocRef);
                
                if (oldDocRef) {
                    transaction.delete(oldDocRef);
                }

                if (newDocSnap.exists() && (!investment || investment.id !== newDocId)) { 
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

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            <Controller
                name="assetType"
                control={control}
                render={({ field }) => (
                    <RadioGroup 
                        onValueChange={field.onChange} 
                        value={field.value} 
                        className="grid grid-cols-2 gap-4"
                        disabled={!!investment}
                    >
                        <div>
                            <RadioGroupItem value="crypto" id="crypto" className="peer sr-only" />
                            <Label htmlFor="crypto" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Criptomoneda</Label>
                        </div>
                        <div>
                            <RadioGroupItem value="stock" id="stock" className="peer sr-only" />
                             <Label htmlFor="stock" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Acción</Label>
                        </div>
                    </RadioGroup>
                )}
            />

            <div>
                <Label htmlFor="asset-search">Activo</Label>
                <AssetSearchCombobox
                    assetType={assetType}
                    selectedAsset={selectedAsset}
                    onSelectAsset={handleSelectAsset}
                    disabled={!!investment}
                />
                {errors.id && <p className="text-sm text-destructive">{errors.id.message}</p>}
                {errors.coinGeckoId && <p className="text-sm text-destructive">{errors.coinGeckoId.message}</p>}
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
