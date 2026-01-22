'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { useToast } from '@/hooks/use-toast';
import { searchStocks } from '@/ai/flows/stock-search';
import { searchCryptos } from '@/ai/flows/crypto-search';
import { cn } from '@/lib/utils';

export interface StockSearchResult {
    symbol: string;
    name: string;
}

export interface CryptoSearchResult {
    id: string; // coingecko id
    symbol: string; // e.g. btc
    name: string;
}

export type AssetSearchResult = StockSearchResult | CryptoSearchResult;

interface AssetSearchComboboxProps {
    assetType: 'crypto' | 'stock';
    selectedAsset: AssetSearchResult | null;
    onSelectAsset: (asset: AssetSearchResult | null) => void;
    disabled?: boolean;
}

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced as (...args: Parameters<F>) => void;
}

export function AssetSearchCombobox({ assetType, selectedAsset, onSelectAsset, disabled }: AssetSearchComboboxProps) {
    const { toast } = useToast();
    const [isListOpen, setIsListOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [stockResults, setStockResults] = useState<StockSearchResult[]>([]);
    const [cryptoResults, setCryptoResults] = useState<CryptoSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync input value with parent's selected asset
    useEffect(() => {
        if (selectedAsset && !isListOpen) {
            setInputValue(`${selectedAsset.name} (${selectedAsset.symbol.toUpperCase()})`);
        }
    }, [selectedAsset, isListOpen]);
    
    // Close list on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsListOpen(false);
                // If there's no selected asset, clear the input on blur
                if (!selectedAsset) {
                    setInputValue('');
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef, selectedAsset]);


    const searchAssets = useCallback(async (query: string) => {
        if (query.length < 1) {
            setStockResults([]);
            setCryptoResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            if (assetType === 'stock') {
                const response = await searchStocks({ query });
                setStockResults(response.results.filter(r => !r.symbol.includes(':') && !r.symbol.includes('.')) || []);
                setCryptoResults([]);
            } else {
                const response = await searchCryptos({ query });
                setCryptoResults(response.results || []);
                setStockResults([]);
            }
        } catch (error) {
            console.error("Failed to search assets:", error);
            toast({ title: 'Error de Búsqueda', description: 'No se pudieron obtener resultados.', variant: 'destructive'});
            setStockResults([]);
            setCryptoResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [assetType, toast]);

    const debouncedSearch = useCallback(debounce(searchAssets, 300), [searchAssets]);

    const handleSelect = (asset: AssetSearchResult) => {
        onSelectAsset(asset);
        setIsListOpen(false);
    };

    const results = assetType === 'stock' ? stockResults : cryptoResults;

    return (
        <Command ref={wrapperRef} shouldFilter={false} className="relative overflow-visible">
            <CommandInput
                placeholder="Busca y selecciona un activo..."
                disabled={disabled}
                value={inputValue}
                onValueChange={(query) => {
                    setInputValue(query);
                    debouncedSearch(query);
                     if (query === '') {
                        onSelectAsset(null);
                    }
                }}
                onFocus={() => {
                    setIsListOpen(true)
                    // Clear input for searching if an asset is already selected
                    if (selectedAsset) {
                        setInputValue('');
                    }
                }}
            />
            {isListOpen && (
                <div className="absolute top-full z-10 mt-1 w-full">
                    <CommandList className="rounded-md border bg-popover text-popover-foreground shadow-md">
                        {isSearching && <CommandEmpty>Buscando...</CommandEmpty>}
                        {!isSearching && results.length === 0 && inputValue.length > 1 && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
                        {!isSearching && results.length > 0 && (
                            <CommandGroup>
                                {results.map((asset) => (
                                    <CommandItem
                                        key={(asset as any).id || (asset as any).symbol}
                                        value={asset.name}
                                        onSelect={() => handleSelect(asset)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedAsset?.name === asset.name ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {asset.name} ({(asset.symbol || '').toUpperCase()})
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </div>
            )}
        </Command>
    );
}