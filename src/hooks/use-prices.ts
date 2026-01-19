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
        // Create a stable key based on the assets that need pricing
        return investments.map(inv => inv.assetType === 'crypto' ? inv.coinGeckoId : inv.symbol).sort().join(',');
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
            
            const cryptoIdsToFetch = [...new Set(cryptoAssets.map(inv => inv.coinGeckoId).filter(Boolean))];
            const stockSymbolsToFetch = [...new Set(stockAssets.map(inv => inv.symbol))];

            try {
                const promises = [];
                if (cryptoIdsToFetch.length > 0) {
                    promises.push(getCryptoPrices({ ids: cryptoIdsToFetch }));
                }
                if (stockSymbolsToFetch.length > 0) {
                    promises.push(getStockPrices({ symbols: stockSymbolsToFetch }));
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
