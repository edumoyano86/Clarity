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
  }),
  outputSchema: z.string().describe('A suggestion for how to save money in this category.'),
}, async (input) => {
  // Mock implementation of savings evaluation.
  // In a real application, this would use more sophisticated logic.
  if (input.amountSpent > 100) {
    return `Consider reducing spending on ${input.spendingCategory} by 10%.`;
  } else {
    return `Spending on ${input.spendingCategory} is reasonable.`;
  }
});

export async function generateSavingsSuggestions(input: SavingsSuggestionsInput): Promise<SavingsSuggestionsOutput> {
  return savingsSuggestionsFlow(input);
}

const savingsSuggestionsPrompt = ai.definePrompt({
  name: 'savingsSuggestionsPrompt',
  input: {schema: SavingsSuggestionsInputSchema},
  output: {schema: SavingsSuggestionsOutputSchema},
  tools: [evaluateSavingsPotential],
  prompt: `Based on the following spending data: {{{spendingData}}}, provide personalized saving suggestions. Use the evaluateSavingsPotential tool to evaluate specific categories.`,
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
