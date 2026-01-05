'use server';

/**
 * @fileOverview A Genkit flow for fetching historical stock prices from Alpha Vantage.
 * 
 * - getStockPriceHistory - A function that takes a stock symbol and returns its daily price history.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const StockHistoryInputSchema = z.object({
  symbol: z.string().describe('The stock ticker symbol (e.g., "AAPL").'),
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
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) {
      console.error('Alpha Vantage API key is not set.');
      return { history: {} };
    }

    // "compact" returns the latest 100 data points. "full" returns up to 20 years.
    // For our 7, 30, 90 day periods, compact is sufficient and much faster.
    const outputSize = 'compact'; 
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${input.symbol}&outputsize=${outputSize}&apikey=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Alpha Vantage API request failed with status ${response.status}`);
      }
      const data = await response.json();
      
      const timeSeries = data['Time Series (Daily)'];

      if (timeSeries) {
        const history: Record<string, number> = {};
        for (const dateStr in timeSeries) {
            // '4. close' is the closing price in the Alpha Vantage response
            const closePrice = parseFloat(timeSeries[dateStr]['4. close']);
            if (!isNaN(closePrice)) {
                history[dateStr] = closePrice;
            }
        }
        return { history };
      }
      
      // Handle API limit messages or other errors
      if (data['Information'] || data['Error Message']) {
          console.warn(`Alpha Vantage API note for ${input.symbol}: ${data['Information'] || data['Error Message']}`);
      }

      return { history: {} };

    } catch (error) {
      console.error(`Error fetching stock history for ${input.symbol}:`, error);
      return { history: {} };
    }
  }
);
