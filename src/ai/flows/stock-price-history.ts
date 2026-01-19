'use server';

/**
 * @fileOverview A Genkit flow for fetching historical stock prices from Finnhub.
 * 
 * - getStockPriceHistory - A function that takes a stock symbol and date range and returns its daily price history.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const StockHistoryInputSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol (e.g., "AAPL").'),
  from: z.number().describe('UNIX timestamp for the start of the date range.'),
  to: z.number().describe('UNIX timestamp for the end of the date range.'),
});
export type StockHistoryInput = z.infer<typeof StockHistoryInputSchema>;

const StockHistoryOutputSchema = z.object({
    history: z.record(z.number()).describe('An object where keys are dates (YYYY-MM-DD) and values are the closing prices.'),
});
export type StockHistoryOutput = z.infer<typeof StockHistoryOutputSchema>;


export async function getStockPriceHistory(input: StockHistoryInput): Promise<StockHistoryOutput> {
  return stockPriceHistoryFlow(input);
}

const stockPriceHistoryFlow = ai.defineFlow(
  {
    name: 'stockPriceHistoryFlow',
    inputSchema: StockHistoryInputSchema,
    outputSchema: StockHistoryOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      console.error('Finnhub API key is not set in .env.local (FINNHUB_API_KEY)');
      // Throw an error if the API key is missing.
      throw new Error('Finnhub API key is not configured.');
    }

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${input.symbol}&resolution=D&from=${input.from}&to=${input.to}&token=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Finnhub API request failed for ${input.symbol} with status ${response.status}`);
        throw new Error(`Finnhub API request failed for ${input.symbol} with status ${response.status}`);
      }
      const data = await response.json();
      
      // The 's' status can be 'no_data', which is a valid response, not an error.
      if (data.s === 'no_data' || !data.t || data.t.length === 0) {
        console.warn(`Finnhub API returned no time data for ${input.symbol}. Status: ${data.s}`);
        return { history: {} }; // Return empty history, not an error.
      }

      const history: Record<string, number> = {};
      for (let i = 0; i < data.t.length; i++) {
        const date = new Date(data.t[i] * 1000);
        const utcDateStr = date.toISOString().split('T')[0];
        history[utcDateStr] = data.c[i];
      }
      return { history };

    } catch (error) {
      console.error(`Error fetching stock history for ${input.symbol}:`, error);
      throw error; // Re-throw the error for the client to handle.
    }
  }
);
