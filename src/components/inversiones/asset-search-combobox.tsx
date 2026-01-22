'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
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
  onSelectAsset,
  disabled,
}: AssetSearchComboboxProps) {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isListVisible, setIsListVisible] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const searchAssets = useCallback(
    async (query: string) => {
      if (query.length < 1) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        if (assetType === 'stock') {
          const response = await searchStocks({ query });
          setResults(
            response.results.filter((r) => !r.symbol.includes(':') && !r.symbol.includes('.')) || []
          );
        } else {
          const response = await searchCryptos({ query });
          setResults(response.results || []);
        }
      } catch (error) {
        console.error('Failed to search assets:', error);
        if ((error as Error).message?.includes('429')) {
             toast({
                title: 'Límite de API alcanzado',
                description: 'Demasiadas búsquedas rápidas. Espera un momento.',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Error de Búsqueda',
                description: 'No se pudieron obtener resultados.',
                variant: 'destructive',
            });
        }
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [assetType, toast]
  );

  const debouncedSearch = useCallback(debounce(searchAssets, 500), [searchAssets]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setInputValue(query);
    onSelectAsset(null); // Clear selection when user types
    if (query) {
      setIsListVisible(true);
      debouncedSearch(query);
    } else {
      setIsListVisible(false);
      setResults([]);
    }
  };

  const handleSelect = (asset: AssetSearchResult) => {
    onSelectAsset(asset);
    setInputValue(`${asset.name} (${asset.symbol.toUpperCase()})`);
    setIsListVisible(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsListVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={searchContainerRef}>
      <Input
        placeholder="Busca un activo..."
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => { if (inputValue && results.length > 0) setIsListVisible(true); }}
        disabled={disabled}
        autoComplete="off"
      />
      {isListVisible && (
        <Card className="absolute top-full z-50 mt-1 w-full max-h-60 overflow-y-auto p-2">
            {isSearching && <div className="p-2 text-sm text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Buscando...</div>}
            {!isSearching && results.length === 0 && inputValue.length > 1 && (
              <div className="p-2 text-sm text-center text-muted-foreground">No se encontraron resultados.</div>
            )}
            {!isSearching && results.length > 0 && (
                <ul className="space-y-1">
                    {results.map((asset) => (
                        <li
                            key={(asset as any).id || (asset as any).symbol}
                            className="flex cursor-pointer items-center justify-between rounded-md p-2 text-sm hover:bg-accent"
                            onClick={() => handleSelect(asset)}
                            onTouchEnd={(e) => { e.preventDefault(); handleSelect(asset); }} // preventDefault to avoid double event
                        >
                            <span>
                                {asset.name}
                                <span className="ml-2 text-muted-foreground">{asset.symbol.toUpperCase()}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
      )}
    </div>
  );
}
