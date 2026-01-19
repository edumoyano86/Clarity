'use server';

/**
 * @fileOverview A Genkit flow for searching crypto assets using the CoinGecko API.
 * 
 * - searchCryptos - A function that takes a search query and returns a list of matching cryptocurrencies.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CryptoSearchInputSchema = z.object({
  query: z.string().describe('The search keywords (e.g., "Bitcoin", "sol").'),
});
export type CryptoSearchInput = z.infer<typeof CryptoSearchInputSchema>;

const CryptoSearchResultSchema = z.object({
  id: z.string(), // e.g., "bitcoin"
  symbol: z.string(), // e.g., "btc"
  name: z.string(), // e.g., "Bitcoin"
});

const CryptoSearchOutputSchema = z.object({
    results: z.array(CryptoSearchResultSchema),
});
export type CryptoSearchOutput = z.infer<typeof CryptoSearchOutputSchema>;


export async function searchCryptos(input: CryptoSearchInput): Promise<CryptoSearchOutput> {
  return cryptoSearchFlow(input);
}

const cryptoSearchFlow = ai.defineFlow(
  {
    name: 'cryptoSearchFlow',
    inputSchema: CryptoSearchInputSchema,
    outputSchema: CryptoSearchOutputSchema,
  },
  async (input) => {
    if (!input.query) {
      return { results: [] };
    }

    const url = `https://api.coingecko.com/api/v3/search?query=${input.query}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`CoinGecko search API request failed with status ${response.status}: ${errorBody}`);
        return { results: [] };
      }
      const data = await response.json();

      if (data.coins && Array.isArray(data.coins)) {
        const results = data.coins.map((coin: any) => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
        }));
        return { results };
      }
      
      return { results: [] };

    } catch (error) {
      console.error('Error searching cryptos:', error);
      return { results: [] };
    }
  }
);
