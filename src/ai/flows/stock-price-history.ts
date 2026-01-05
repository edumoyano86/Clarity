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
    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.error('Finnhub API key is not set.');
      return { history: {} };
    }

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${input.symbol}&resolution=D&from=${input.from}&to=${input.to}&token=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Finnhub API request failed with status ${response.status}`);
      }
      const data = await response.json();
      
      if (data.s !== 'ok') {
        // Finnhub can return 200 OK but with an error status in the JSON body
        console.warn(`Finnhub API returned status '${data.s}' for ${input.symbol}`);
        return { history: {} };
      }

      const history: Record<string, number> = {};
      if (data.t && data.c) {
          for (let i = 0; i < data.t.length; i++) {
            const date = new Date(data.t[i] * 1000);
            const dateStr = date.toISOString().split('T')[0]; // Format to YYYY-MM-DD
            history[dateStr] = data.c[i];
          }
      }
      return { history };

    } catch (error) {
      console.error(`Error fetching stock history for ${input.symbol}:`, error);
      return { history: {} };
    }
  }
);
