'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PriceData } from '@/lib/definitions';
import { getStockPrices } from '@/ai/flows/stock-prices';
import { useToast } from './use-toast';

export function usePrices(investments: Investment[] | null) {
    const [prices, setPrices] = useState<PriceData>({});
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    
    const investmentsKey = useMemo(() => investments?.map(inv => `${inv.id}-${inv.symbol}`).join(',') || '', [investments]);

    useEffect(() => {
        const fetchPrices = async () => {
            if (!investments || investments.length === 0) {
                setPrices({});
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);

            // Finnhub's /quote endpoint can fetch both stocks and crypto prices
            const allSymbols = [...new Set(investments.map(inv => inv.symbol))];

            try {
                if (allSymbols.length > 0) {
                    const pricesResult = await getStockPrices({ symbols: allSymbols });
                    setPrices(pricesResult);
                } else {
                    setPrices({});
                }

            } catch (error) {
                console.error("Failed to fetch asset prices:", error);
                toast({
                    title: 'Error de Precios',
                    description: 'No se pudieron obtener algunas cotizaciones de los activos.',
                    variant: 'destructive'
                });
                setPrices({});
            } finally {
                setIsLoading(false);
            }
        };

        fetchPrices();
    // Depend on the memoized key of investments to refetch when they change.
    }, [investmentsKey, toast]);

    return { prices, isLoading };
}
