'use server';

/**
 * @fileOverview A Genkit flow for fetching cryptocurrency prices from the Finnhub API.
 * 
 * - getCryptoPrices - A function that takes an array of Finnhub crypto symbols and returns their current prices in USD.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Input schema for the flow
const CryptoPricesInputSchema = z.object({
  symbols: z.array(z.string()).describe('An array of Finnhub crypto symbols (e.g., ["BINANCE:BTCUSDT", "BINANCE:ETHUSDT"]).'),
});
export type CryptoPricesInput = z.infer<typeof CryptoPricesInputSchema>;

// Output schema for the flow
const PricesOutputSchema = z.record(z.object({
    price: z.number(),
})).describe('An object where keys are asset symbols and values are their prices.');
export type PricesOutput = z.infer<typeof PricesOutputSchema>;


// The main exported function that components will call
export async function getCryptoPrices(input: CryptoPricesInput): Promise<PricesOutput> {
  return cryptoPricesFlow(input);
}


// The Genkit flow definition
const cryptoPricesFlow = ai.defineFlow(
  {
    name: 'cryptoPricesFlow',
    inputSchema: CryptoPricesInputSchema,
    outputSchema: PricesOutputSchema,
  },
  async (input) => {
    if (input.symbols.length === 0) {
      return {};
    }

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
        // To avoid rate limiting on free tier
        await new Promise(resolve => setTimeout(resolve, 350));
      } catch (error) {
        console.error(`Error fetching crypto price for ${symbol}:`, error);
      }
    }

    return results;
  }
);
