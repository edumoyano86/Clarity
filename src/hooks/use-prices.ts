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
        return investments.map(inv => inv.assetType === 'crypto' ? (inv.coinGeckoId || inv.id) : inv.symbol).sort().join(',');
    }, [investments]);

    useEffect(() => {
        const fetchPrices = async () => {
            if (!investments || investments.length === 0) {
                setPrices({});
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);

            const cryptoAssets = investments.filter(i => i.assetType === 'crypto' && i.coinGeckoId);
            const stockAssets = investments.filter(i => i.assetType === 'stock');
            
            const cryptoIdsToFetch = [...new Set(cryptoAssets.map(inv => inv.coinGeckoId!))];
            const stockSymbolsToFetch = [...new Set(stockAssets.map(inv => inv.symbol))];

            try {
                const promises = [];
                if (cryptoIdsToFetch.length > 0) {
                    promises.push(getCryptoPrices({ ids: cryptoIdsToFetch }));
                }
                if (stockSymbolsToFetch.length > 0) {
                    promises.push(getStockPrices({ symbols: stockSymbolsToFetch }));
                }
                
                const results = await Promise.allSettled(promises);
                
                const combinedPrices = results.reduce((acc, result) => {
                    if (result.status === 'fulfilled' && result.value) {
                       return { ...acc, ...result.value };
                    }
                     if (result.status === 'rejected') {
                        console.warn('Partial failure fetching prices:', result.reason);
                    }
                    return acc;
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
