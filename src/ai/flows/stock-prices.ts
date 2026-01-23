'use server';

/**
 * @fileOverview A Genkit flow for fetching a stock price from the Finnhub API.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const StockPricesInputSchema = z.object({
  symbol: z.string().describe('A stock ticker symbol (e.g., "AAPL").'),
});
export type StockPricesInput = z.infer<typeof StockPricesInputSchema>;

const PricesOutputSchema = z.record(z.object({
    price: z.number(),
})).describe('An object where the key is the symbol and value is its current price.');
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
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      console.warn('La clave de API de Finnhub no está configurada. La obtención de precios de acciones estará deshabilitada. Por favor, añade FINNHUB_API_KEY a tu archivo .env para habilitarla.');
      return {};
    }

    const { symbol } = input;
    if (!symbol) {
        return {};
    }

    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        // Throw an error to be handled by the client
        throw new Error(`Finnhub API request for ${symbol} failed with status ${response.status}`);
      }
      const data = await response.json();
      
      if (typeof data.c === 'number') {
        return { [symbol]: { price: data.c } };
      } else {
        console.warn(`No current price data for symbol: ${symbol}`, data);
        return {};
      }
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      // Re-throw to let client-side handle it.
      throw error;
    }
  }
);
