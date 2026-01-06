'use server';

/**
 * @fileOverview A Genkit flow for searching cryptocurrency symbols using the Finnhub API.
 * 
 * - searchCryptos - A function that takes a search query and returns a list of matching cryptocurrencies.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

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

const cryptoSearchFlow = ai.defineFlow(
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

    if (!input.query) {
      return { results: [] };
    }

    const url = `https://finnhub.io/api/v1/search?q=${input.query}&token=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Finnhub API request failed with status ${response.status}`);
      }
      const data = await response.json();

      if (data.result && Array.isArray(data.result)) {
        const results = data.result
          .filter((match: any) => match.type === 'Crypto')
          .map((match: any) => ({
            symbol: match.symbol,
            name: match.description,
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
