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
    
    const investmentsKey = useMemo(() => investments?.map(inv => inv.id).join(',') || '', [investments]);

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

            const cryptoIds = [...new Set(cryptoAssets.map(inv => inv.coinGeckoId).filter(Boolean) as string[])];
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
    }, [investmentsKey, toast]);

    return { prices, isLoading };
}
