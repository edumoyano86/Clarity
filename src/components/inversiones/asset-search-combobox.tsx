'use client';

import React, { useState, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
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
    onSelectAsset: (asset: AssetSearchResult) => void;
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
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [stockResults, setStockResults] = useState<StockSearchResult[]>([]);
    const [cryptoResults, setCryptoResults] = useState<CryptoSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

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
        setIsPopoverOpen(false);
        setSearchQuery('');
    };

    // Reset search when popover closes
    React.useEffect(() => {
        if (!isPopoverOpen) {
            setSearchQuery('');
            setStockResults([]);
            setCryptoResults([]);
            setIsSearching(false);
        }
    }, [isPopoverOpen]);

    const results = assetType === 'stock' ? stockResults : cryptoResults;

    return (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isPopoverOpen}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {selectedAsset
                        ? `${selectedAsset.name} (${selectedAsset.symbol.toUpperCase()})`
                        : "Busca y selecciona un activo..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={assetType === 'crypto' ? "Busca cripto (ej: bitcoin)..." : "Busca acción (ej: AAPL)..."}
                        value={searchQuery}
                        onValueChange={(query) => {
                            setSearchQuery(query);
                            debouncedSearch(query);
                        }}
                    />
                    <CommandList>
                        {isSearching && <CommandEmpty>Buscando...</CommandEmpty>}
                        {!isSearching && results.length === 0 && searchQuery.length > 1 && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
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
                </Command>
            </PopoverContent>
        </Popover>
    );
}
