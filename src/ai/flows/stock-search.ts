'use server';

/**
 * @fileOverview A Genkit flow for searching stock symbols using the Finnhub API.
 * 
 * - searchStocks - A function that takes a search query and returns a list of matching assets.
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
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      console.warn('La clave de API de Finnhub no está configurada. La búsqueda de acciones estará deshabilitada. Por favor, añade FINNHUB_API_KEY a tu archivo .env para habilitarla.');
      return { results: [] };
    }

    if (!input.query) {
      return { results: [] };
    }

    const url = `https://finnhub.io/api/v1/search?q=${input.query}&token=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Finnhub API request failed with status ${response.status}`);
        throw new Error(`Finnhub API request failed with status ${response.status}`);
      }
      const data = await response.json();

      if (data.result && Array.isArray(data.result)) {
        // Filter out non-common stock symbols and derivatives to simplify
        const results = data.result
          .filter((match: any) => !match.symbol.includes('.') && !match.symbol.includes(':'))
          .map((match: any) => ({
            symbol: match.symbol,
            name: match.description,
          }));
        return { results };
      }
      
      return { results: [] };

    } catch (error) {
      console.error('Error searching stocks:', error);
      throw error;
    }
  }
);
