'use server';

/**
 * @fileOverview A Genkit flow for fetching stock prices from the Finnhub API.
 * 
 * - getStockPrices - A function that takes an array of stock symbols and returns their current prices.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const StockPricesInputSchema = z.object({
  symbols: z.array(z.string()).describe('An array of stock ticker symbols (e.g., ["AAPL", "GOOGL"]).'),
});
export type StockPricesInput = z.infer<typeof StockPricesInputSchema>;

const PricesOutputSchema = z.record(z.object({
    price: z.number(),
})).describe('An object where keys are symbols and values are their prices.');
export type PricesOutput = z.infer<typeof PricesOutputSchema>;

export async function getStockPrices(input: StockPricesInput): Promise<PricesOutput> {
  return stockPricesFlow(input);
}

const stockPricesFlow = ai.defineFlow(
  {
    name: 'stockPricesFlow',
    inputSchema: StockPricesInputSchema,
    outputSchema: PricesOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.error('Finnhub API key is not set.');
      return {};
    }

    const results: PricesOutput = {};
    const baseUrl = 'https://finnhub.io/api/v1/quote';

    // Finnhub API requires one call per symbol for quotes
    for (const symbol of input.symbols) {
      const url = `${baseUrl}?symbol=${symbol}&token=${apiKey}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Finnhub API request for ${symbol} failed with status ${response.status}`);
          continue; // Continue to the next symbol
        }
        const data = await response.json();
        // 'c' is the current price in the Finnhub response
        if (typeof data.c === 'number') {
            results[symbol] = { price: data.c };
        }
      } catch (error) {
        console.error(`Error fetching stock price for ${symbol}:`, error);
      }
    }

    return results;
  }
);
