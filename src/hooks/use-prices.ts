'use client';

import { useState, useEffect } from 'react';
import { Investment, PriceData } from '@/lib/definitions';
import { getCryptoPrices } from '@/ai/flows/crypto-prices';
import { getStockPrices } from '@/ai/flows/stock-prices';
import { useToast } from './use-toast';

export function usePrices(investments: Investment[] | null) {
    const [prices, setPrices] = useState<PriceData>({});
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    
    const investmentsKey = investments?.map(inv => `${inv.id}-${inv.assetId}`).join(',') || '';

    useEffect(() => {
        const fetchPrices = async () => {
            if (!investments || investments.length === 0) {
                setPrices({});
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);

            // Finnhub uses symbols for both. For crypto, `assetId` is the finnhub symbol. For stocks, `symbol` is the ticker.
            const cryptoSymbols = [...new Set(investments.filter(i => i.assetType === 'crypto').map(inv => inv.assetId))];
            const stockSymbols = [...new Set(investments.filter(i => i.assetType === 'stock').map(inv => inv.symbol))];

            try {
                const [cryptoPrices, stockPrices] = await Promise.all([
                    cryptoSymbols.length > 0 ? getCryptoPrices({ symbols: cryptoSymbols }) : Promise.resolve({}),
                    stockSymbols.length > 0 ? getStockPrices({ symbols: stockSymbols }) : Promise.resolve({}),
                ]);
                
                // When mapping crypto prices, the key is the Finnhub symbol (which is our assetId).
                // For stocks, the key is the ticker symbol (which is our investment.symbol).
                const combinedPrices: PriceData = { ...cryptoPrices, ...stockPrices };
                setPrices(combinedPrices);

            } catch (error) {
                console.error("Failed to fetch asset prices:", error);
                toast({
                    title: 'Error de Precios',
                    description: 'No se pudieron obtener algunas cotizaciones de los activos.',
                    variant: 'destructive'
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchPrices();
    }, [investmentsKey, toast]); 

    return { prices, isLoading };
}
