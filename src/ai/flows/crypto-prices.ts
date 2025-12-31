'use server';

/**
 * @fileOverview A Genkit flow for fetching cryptocurrency prices from the CoinGecko API.
 * 
 * - getCryptoPrices - A function that takes an array of asset IDs and returns their current prices in USD.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Input schema for the flow
const CryptoPricesInputSchema = z.object({
  assetIds: z.array(z.string()).describe('An array of CoinGecko asset IDs (e.g., ["bitcoin", "ethereum"]).'),
});
export type CryptoPricesInput = z.infer<typeof CryptoPricesInputSchema>;

// Output schema for the flow
const PricesOutputSchema = z.record(z.object({
    price: z.number(),
})).describe('An object where keys are asset IDs/symbols and values are their prices.');
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
    if (input.assetIds.length === 0) {
      return {};
    }

    const ids = input.assetIds.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API request failed with status ${response.status}`);
      }
      const data = await response.json();
      
      // Transform the data to match the new PricesOutput schema
      const transformedData: PricesOutput = {};
      for (const key in data) {
        if (data[key] && typeof data[key].usd === 'number') {
          transformedData[key] = { price: data[key].usd };
        }
      }
      return transformedData;

    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      return {};
    }
  }
);
