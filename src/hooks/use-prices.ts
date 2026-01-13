'use client';

import { useState, useEffect, useMemo } from 'react';
import { Investment, PriceData } from '@/lib/definitions';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
import { getStockPrices } from '@/ai/flows/stock-prices';
import { useToast } from './use-toast';

export function usePrices(investments: Investment[] | null) {
    const [prices, setPrices] = useState<PriceData>({});
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    
    const investmentsKey = useMemo(() => {
        if (!investments) return '';
        // Use a more robust key including all relevant info
        return investments.map(inv => `${inv.id}-${inv.assetType}`).sort().join(',');
    }, [investments]);

    useEffect(() => {
        const fetchPrices = async () => {
            if (!investments || investments.length === 0) {
                setPrices({});
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);

            const cryptoAssets = investments.filter(i => i.assetType === 'crypto');
            const stockAssets = investments.filter(i => i.assetType === 'stock');
            
            // For crypto, use coinGeckoId if present, otherwise fall back to the id (for legacy data)
            const cryptoIds = [...new Set(cryptoAssets.map(inv => inv.coinGeckoId || inv.id).filter(Boolean))];
            const stockSymbols = [...new Set(stockAssets.map(inv => inv.symbol))];

            try {
                const promises = [];
                if (cryptoIds.length > 0) {
                    promises.push(getCryptoPrices({ ids: cryptoIds }));
                }
                if (stockSymbols.length > 0) {
                    promises.push(getStockPrices({ symbols: stockSymbols }));
                }
                
                const results = await Promise.all(promises);
                
                const combinedPrices = results.reduce((acc, current) => {
                    return { ...acc, ...current };
                }, {});

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
    }, [investmentsKey, toast]); 

    return { prices, isLoading };
}
