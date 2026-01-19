'use server';

/**
 * @fileOverview A Genkit flow for fetching current crypto prices from CoinGecko.
 * 
 * - getCryptoPrices - A function that takes an array of CoinGecko coin IDs and returns their current prices.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CryptoPricesInputSchema = z.object({
  ids: z.array(z.string()).describe('An array of CoinGecko coin IDs (e.g., ["bitcoin", "ethereum"]).'),
});
export type CryptoPricesInput = z.infer<typeof CryptoPricesInputSchema>;

const PricesOutputSchema = z.record(z.object({
    price: z.number(),
})).describe('An object where keys are coin IDs and values contain their current price in USD.');
export type PricesOutput = z.infer<typeof PricesOutputSchema>;

export async function getCryptoPrices(input: CryptoPricesInput): Promise<PricesOutput> {
  return cryptoPricesFlow(input);
}

const cryptoPricesFlow = ai.defineFlow(
  {
    name: 'cryptoPricesFlow',
    inputSchema: CryptoPricesInputSchema,
    outputSchema: PricesOutputSchema,
  },
  async (input) => {
    if (input.ids.length === 0) {
      return {};
    }

    const idsString = input.ids.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsString}&vs_currencies=usd`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`CoinGecko simple price API request failed with status ${response.status}: ${errorBody}`);
        return {};
      }
      const data = await response.json();

      const results: PricesOutput = {};
      for (const id in data) {
        if (data[id] && typeof data[id].usd === 'number') {
          results[id] = { price: data[id].usd };
        }
      }
      return results;

    } catch (error) {
      console.error(`Error fetching crypto prices:`, error);
      return {};
    }
  }
);
