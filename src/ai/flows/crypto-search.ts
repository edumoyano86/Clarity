'use server';

/**
 * @fileOverview A Genkit flow for searching cryptocurrency symbols using the Finnhub API.
 * This flow fetches all symbols from Binance and filters them based on the query.
 * - searchCryptos - A function that takes a search query and returns a list of matching cryptocurrencies.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { flow } from 'genkit';

let allCryptoSymbols: { symbol: string; name: string }[] = [];
let lastFetchTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

const CryptoSearchInputSchema = z.object({
  query: z.string().describe('The search keywords (e.g., "Bitcoin", "BTC").'),
});
export type CryptoSearchInput = z.infer<typeof CryptoSearchInputSchema>;

const CryptoSearchResultSchema = z.object({
  symbol: z.string(),
  name: z.string(),
});

const CryptoSearchOutputSchema = z.object({
    results: z.array(CryptoSearchResultSchema),
});
export type CryptoSearchOutput = z.infer<typeof CryptoSearchOutputSchema>;

export async function searchCryptos(input: CryptoSearchInput): Promise<CryptoSearchOutput> {
  return cryptoSearchFlow(input);
}

const cryptoSearchFlow = flow(
  {
    name: 'cryptoSearchFlow',
    inputSchema: CryptoSearchInputSchema,
    outputSchema: CryptoSearchOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.error('Finnhub API key is not set.');
      return { results: [] };
    }

    const now = Date.now();
    if (now - lastFetchTimestamp > CACHE_DURATION || allCryptoSymbols.length === 0) {
      try {
        const url = `https://finnhub.io/api/v1/crypto/symbol?exchange=binance&token=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Finnhub API request failed with status ${response.status}`);
        }
        const data = await response.json();
        
        if (Array.isArray(data)) {
            allCryptoSymbols = data.map((item: any) => ({
                symbol: item.symbol,
                name: item.description || item.displaySymbol || item.symbol,
            }));
            lastFetchTimestamp = now;
        }
      } catch (error) {
        console.error('Error fetching all crypto symbols:', error);
        // Don't return, try to use stale cache if available
      }
    }

    if (!input.query) {
      return { results: allCryptoSymbols.slice(0, 50) }; // Return a subset if query is empty
    }

    const lowerCaseQuery = input.query.toLowerCase();
    const results = allCryptoSymbols
      .filter(
        (crypto) =>
          crypto.name.toLowerCase().includes(lowerCaseQuery) ||
          crypto.symbol.toLowerCase().includes(lowerCaseQuery)
      )
      .slice(0, 50); // Limit results for performance

    return { results };
  }
);
