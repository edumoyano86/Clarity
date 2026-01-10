'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PriceData } from '@/lib/definitions';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
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

            const cryptoIds = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.symbol))];
            const stockSymbols = [...new Set(investments.filter(i => i.assetType === 'stock').map(inv => inv.symbol))];

            try {
                const pricePromises = [];

                if (cryptoIds.length > 0) {
                    pricePromises.push(getCryptoPrices({ ids: cryptoIds }));
                }
                if (stockSymbols.length > 0) {
                    pricePromises.push(getStockPrices({ symbols: stockSymbols }));
                }
                
                const results = await Promise.all(pricePromises);
                const combinedPrices = Object.assign({}, ...results);
                setPrices(combinedPrices);

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
