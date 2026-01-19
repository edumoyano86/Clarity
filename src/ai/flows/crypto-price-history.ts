'use server';

/**
 * @fileOverview A Genkit flow for fetching historical crypto prices from CoinGecko.
 * 
 * - getCryptoPriceHistory - A function that takes a crypto ID and date range and returns its daily price history.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CryptoHistoryInputSchema = z.object({
  id: z.string().describe('The CoinGecko coin ID (e.g., "bitcoin").'),
  from: z.number().describe('UNIX timestamp for the start of the date range.'),
  to: z.number().describe('UNIX timestamp for the end of the date range.'),
});
export type CryptoHistoryInput = z.infer<typeof CryptoHistoryInputSchema>;

const CryptoHistoryOutputSchema = z.object({
    history: z.record(z.number()).describe('An object where keys are dates (YYYY-MM-DD) and values are the closing prices.'),
});
export type CryptoHistoryOutput = z.infer<typeof CryptoHistoryOutputSchema>;

export async function getCryptoPriceHistory(input: CryptoHistoryInput): Promise<CryptoHistoryOutput> {
  return cryptoPriceHistoryFlow(input);
}

const cryptoPriceHistoryFlow = ai.defineFlow(
  {
    name: 'cryptoPriceHistoryFlow',
    inputSchema: CryptoHistoryInputSchema,
    outputSchema: CryptoHistoryOutputSchema,
  },
  async (input) => {
    // CoinGecko's free API is rate-limited, but should be fine for this server-side use.
    // No API key needed for this public endpoint.
    const url = `https://api.coingecko.com/api/v3/coins/${input.id}/market_chart/range?vs_currency=usd&from=${input.from}&to=${input.to}&precision=full`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorBody = await response.text();
        // Log the error for server-side debugging
        console.error(`CoinGecko API request failed for ${input.id} with status ${response.status}: ${errorBody}`);
        // Throw an error to be handled by the client-side caller
        throw new Error(`CoinGecko API request failed for ${input.id} with status ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.prices || data.prices.length === 0) {
        console.warn(`CoinGecko API returned no price data for ${input.id}`);
        return { history: {} };
      }

      const history: Record<string, number> = {};
      for (const [timestamp, price] of data.prices) {
        const date = new Date(timestamp);
        // Using toISOString().split('T')[0] to get 'YYYY-MM-DD' in UTC
        const utcDateStr = date.toISOString().split('T')[0];
        history[utcDateStr] = price;
      }
      return { history };

    } catch (error) {
      console.error(`Error fetching crypto history for ${input.id}:`, error);
      // Re-throw the error so the client knows something went wrong.
      throw error;
    }
  }
);
