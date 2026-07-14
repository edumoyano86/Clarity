// savings-suggestions.ts
'use server';

/**
 * @fileOverview Provides personalized saving suggestions based on user spending patterns.
 *
 * - generateSavingsSuggestions - A function that generates personalized saving suggestions.
 * - SavingsSuggestionsInput - The input type for the generateSavingsSuggestions function.
 * - SavingsSuggestionsOutput - The return type for the generateSavingsSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SavingsSuggestionsInputSchema = z.object({
  spendingData: z.string().describe('A summary of the user\'s spending data, including categories and amounts.'),
  totalSpent: z.number().describe('The total amount spent for the period being analyzed.'),
  topCategories: z.array(z.string()).describe('The categories with the highest spending so far.'),
});
export type SavingsSuggestionsInput = z.infer<typeof SavingsSuggestionsInputSchema>;

const SavingsSuggestionsOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('A list of personalized saving suggestions based on the user\'s spending patterns.'),
});
export type SavingsSuggestionsOutput = z.infer<typeof SavingsSuggestionsOutputSchema>;

const evaluateSavingsPotential = ai.defineTool({
  name: 'evaluateSavingsPotential',
  description: 'Evaluates the potential for savings in different spending categories.',
  inputSchema: z.object({
    spendingCategory: z.string().describe('The category of spending to evaluate.'),
    amountSpent: z.number().describe('The amount spent in the category.'),
    totalSpent: z.number().describe('The total amount spent by the user during the analyzed period.'),
  }),
  outputSchema: z.string().describe('A suggestion for how to save money in this category.'),
}, async (input) => {
  const share = (input.amountSpent / Math.max(input.totalSpent, 1)) * 100;
  if (share > 30) {
    return `Consider reducing spending on ${input.spendingCategory} by at least 10% and tracking this category weekly.`;
  }
  if (input.amountSpent > 100) {
    return `Review recurring expenses in ${input.spendingCategory} and look for one monthly subscription or purchase you can postpone.`;
  }
  return `Spending on ${input.spendingCategory} looks manageable; keep an eye on it to avoid drifting above your usual pattern.`;
});

export async function generateSavingsSuggestions(input: SavingsSuggestionsInput): Promise<SavingsSuggestionsOutput> {
  return savingsSuggestionsFlow(input);
}

const savingsSuggestionsPrompt = ai.definePrompt({
  name: 'savingsSuggestionsPrompt',
  input: {schema: SavingsSuggestionsInputSchema},
  output: {schema: SavingsSuggestionsOutputSchema},
  tools: [evaluateSavingsPotential],
  prompt: `Based on the spending data below: {{{spendingData}}}. The total spent this period is {{{totalSpent}}}. The highest-spending categories are {{{topCategories}}}. Provide 3 to 5 personalized saving suggestions in Spanish. Use the evaluateSavingsPotential tool to evaluate the most relevant categories and keep recommendations practical, specific, and focused on reducing waste or avoiding recurring over-spending.`,
});

const savingsSuggestionsFlow = ai.defineFlow(
  {
    name: 'savingsSuggestionsFlow',
    inputSchema: SavingsSuggestionsInputSchema,
    outputSchema: SavingsSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await savingsSuggestionsPrompt(input);
    return output!;
  }
);
