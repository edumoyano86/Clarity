'use client';

import React, { useState, useCallback } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useToast } from '@/hooks/use-toast';
import { searchStocks } from '@/ai/flows/stock-search';
import { searchCryptos } from '@/ai/flows/crypto-search';

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

export function AssetSearchCombobox({
  assetType,
  selectedAsset,
  onSelectAsset,
  disabled,
}: AssetSearchComboboxProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [stockResults, setStockResults] = useState<StockSearchResult[]>([]);
  const [cryptoResults, setCryptoResults] = useState<CryptoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchAssets = useCallback(
    async (query: string) => {
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
          setStockResults(
            response.results.filter((r) => !r.symbol.includes(':') && !r.symbol.includes('.')) || []
          );
          setCryptoResults([]);
        } else {
          const response = await searchCryptos({ query });
          setCryptoResults(response.results || []);
          setStockResults([]);
        }
      } catch (error) {
        console.error('Failed to search assets:', error);
        if ((error as Error).message?.includes('429')) {
             toast({
                title: 'Límite de API alcanzado',
                description: 'Demasiadas búsquedas rápidas. Por favor, espera un momento y vuelve a intentarlo.',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Error de Búsqueda',
                description: 'No se pudieron obtener resultados.',
                variant: 'destructive',
            });
        }
        setStockResults([]);
        setCryptoResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [assetType, toast]
  );

  const debouncedSearch = useCallback(debounce(searchAssets, 500), [searchAssets]);

  const results = assetType === 'stock' ? stockResults : cryptoResults;

  const handleSelect = (asset: AssetSearchResult) => {
    onSelectAsset(asset);
    setInputValue('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedAsset
            ? `${selectedAsset.name} (${selectedAsset.symbol.toUpperCase()})`
            : 'Busca y selecciona un activo...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Busca un activo..."
            value={inputValue}
            onValueChange={(query) => {
              setInputValue(query);
              debouncedSearch(query);
            }}
          />
          <CommandList>
            {isSearching && <div className="p-4 text-sm text-center">Buscando...</div>}
            {!isSearching && results.length === 0 && inputValue.length > 1 && (
              <CommandEmpty>No se encontraron resultados.</CommandEmpty>
            )}
            {!isSearching && results.length > 0 && (
              <CommandGroup>
                {results.map((asset) => (
                  <CommandItem
                    key={(asset as any).id || (asset as any).symbol}
                    value={`${asset.name} ${asset.symbol}`}
                    onSelect={() => handleSelect(asset)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedAsset?.name === asset.name ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {asset.name}
                    <span className="ml-2 text-muted-foreground">{asset.symbol.toUpperCase()}</span>
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
