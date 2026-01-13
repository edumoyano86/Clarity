'use server';

/**
 * @fileOverview A Genkit flow for fetching stock prices from the Finnhub API.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const StockPricesInputSchema = z.object({
  symbols: z.array(z.string()).describe('An array of stock ticker symbols (e.g., ["AAPL", "MSFT"]).'),
});
export type StockPricesInput = z.infer<typeof StockPricesInputSchema>;

const PricesOutputSchema = z.record(z.object({
    price: z.number(),
})).describe('An object where keys are symbols and values are their current prices.');
export type PricesOutput = z.infer<typeof PricesOutputSchema>;

export async function getStockPrices(input: StockPricesInput): Promise<PricesOutput> {
  return stockPricesFlow(input);
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const stockPricesFlow = ai.defineFlow(
  {
    name: 'stockPricesFlow',
    inputSchema: StockPricesInputSchema,
    outputSchema: PricesOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      console.error('Finnhub API key is not set in .env.local (FINNHUB_API_KEY)');
      return {};
    }

    const results: PricesOutput = {};
    const baseUrl = 'https://finnhub.io/api/v1/quote';

    // Finnhub API requires one call per symbol for quotes
    for (const symbol of input.symbols) {
      if (!symbol) continue;
      const url = `${baseUrl}?symbol=${symbol}&token=${apiKey}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Finnhub quote API request for ${symbol} failed with status ${response.status}`);
          continue; // Continue to the next symbol
        }
        const data = await response.json();
        // 'c' is the current price in the Finnhub response
        if (typeof data.c === 'number') {
            results[symbol] = { price: data.c };
        } else {
            console.warn(`No current price data for symbol: ${symbol}`, data);
        }
         // To avoid rate limiting on free tier
        await delay(350);
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
      }
    }

    return results;
  }
);
