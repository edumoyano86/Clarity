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
    
    const investmentsKey = useMemo(() => investments?.map(inv => `${inv.id}-${inv.amount}`).join(',') || '', [investments]);

    useEffect(() => {
        const fetchPrices = async () => {
            if (!investments || investments.length === 0) {
                setPrices({});
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);

            const cryptoSymbols = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            const stockSymbols = [...new Set(investments.filter(i => i.assetType === 'stock').map(inv => inv.symbol))];

            try {
                const [cryptoPrices, stockPrices] = await Promise.all([
                    cryptoSymbols.length > 0 ? getCryptoPrices({ symbols: cryptoSymbols }) : Promise.resolve({}),
                    stockSymbols.length > 0 ? getStockPrices({ symbols: stockSymbols }) : Promise.resolve({}),
                ]);
                
                const combinedPrices: PriceData = { ...cryptoPrices, ...stockPrices };
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
    }, [investmentsKey]);

    return { prices, isLoading };
}
