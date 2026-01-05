'use server';

/**
 * @fileOverview A Genkit flow for fetching historical crypto prices from Finnhub.
 * 
 * - getCryptoPriceHistory - A function that takes a crypto symbol and date range and returns its daily price history.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CryptoHistoryInputSchema = z.object({
  symbol: z.string().describe('The Finnhub crypto symbol (e.g., "BINANCE:BTCUSDT").'),
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
    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.error('Finnhub API key is not set.');
      return { history: {} };
    }

    const url = `https://finnhub.io/api/v1/crypto/candle?symbol=${input.symbol}&resolution=D&from=${input.from}&to=${input.to}&token=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Finnhub API request failed for ${input.symbol} with status ${response.status}`);
      }
      const data = await response.json();
      
      if (data.s !== 'ok' || !data.t) {
        console.warn(`Finnhub API returned status '${data.s}' for ${input.symbol}`);
        return { history: {} };
      }

      const history: Record<string, number> = {};
      for (let i = 0; i < data.t.length; i++) {
        const date = new Date(data.t[i] * 1000);
        const utcDateStr = date.toISOString().split('T')[0];
        history[utcDateStr] = data.c[i];
      }
      return { history };

    } catch (error) {
      console.error(`Error fetching crypto history for ${input.symbol}:`, error);
      return { history: {} };
    }
  }
);
