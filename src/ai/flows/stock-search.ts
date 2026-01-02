'use server';

/**
 * @fileOverview A Genkit flow for searching stock symbols using the Alpha Vantage API.
 * 
 * - searchStocks - A function that takes a search query and returns a list of matching stocks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const StockSearchInputSchema = z.object({
  query: z.string().describe('The search keywords (e.g., "Apple", "TSLA").'),
});
export type StockSearchInput = z.infer<typeof StockSearchInputSchema>;

const StockSearchResultSchema = z.object({
  symbol: z.string(),
  name: z.string(),
});

const StockSearchOutputSchema = z.object({
    results: z.array(StockSearchResultSchema),
});
export type StockSearchOutput = z.infer<typeof StockSearchOutputSchema>;


export async function searchStocks(input: StockSearchInput): Promise<StockSearchOutput> {
  return stockSearchFlow(input);
}

const stockSearchFlow = ai.defineFlow(
  {
    name: 'stockSearchFlow',
    inputSchema: StockSearchInputSchema,
    outputSchema: StockSearchOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) {
      console.error('Alpha Vantage API key is not set.');
      return { results: [] };
    }

    if (!input.query) {
      return { results: [] };
    }

    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${input.query}&apikey=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Alpha Vantage API request failed with status ${response.status}`);
      }
      const data = await response.json();

      // The API returns an object with a "bestMatches" array
      if (data.bestMatches && Array.isArray(data.bestMatches)) {
        const results = data.bestMatches.map((match: any) => ({
          symbol: match['1. symbol'],
          name: match['2. name'],
        }));
        return { results };
      }
      
      return { results: [] };

    } catch (error) {
      console.error('Error searching stocks:', error);
      return { results: [] };
    }
  }
);
