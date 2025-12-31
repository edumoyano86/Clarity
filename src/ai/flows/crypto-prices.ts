'use server';

/**
 * @fileOverview A Genkit flow for fetching cryptocurrency prices from the CoinGecko API.
 * 
 * - getCryptoPrices - A function that takes an array of coin IDs and returns their current prices in USD.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input schema for the flow
const CryptoPricesInputSchema = z.object({
  coinIds: z.array(z.string()).describe('An array of CoinGecko coin IDs (e.g., ["bitcoin", "ethereum"]).'),
});
export type CryptoPricesInput = z.infer<typeof CryptoPricesInputSchema>;

// Output schema for the flow
const CryptoPricesOutputSchema = z.record(z.object({
    usd: z.number(),
})).describe('An object where keys are coin IDs and values are their prices in USD.');
export type CryptoPricesOutput = z.infer<typeof CryptoPricesOutputSchema>;


// The main exported function that components will call
export async function getCryptoPrices(input: CryptoPricesInput): Promise<CryptoPricesOutput> {
  return cryptoPricesFlow(input);
}


// The Genkit flow definition
const cryptoPricesFlow = ai.defineFlow(
  {
    name: 'cryptoPricesFlow',
    inputSchema: CryptoPricesInputSchema,
    outputSchema: CryptoPricesOutputSchema,
  },
  async (input) => {
    if (input.coinIds.length === 0) {
      return {};
    }

    const ids = input.coinIds.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API request failed with status ${response.status}`);
      }
      const data: CryptoPricesOutput = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      // Return an empty object or handle the error as needed
      return {};
    }
  }
);
