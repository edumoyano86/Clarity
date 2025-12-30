// budget-alerts.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating budget alerts.
 *
 * It exports:
 * - `generateBudgetAlert` - A function that generates a budget alert based on user spending and budget limits.
 * - `BudgetAlertInput` - The input type for the generateBudgetAlert function.
 * - `BudgetAlertOutput` - The return type for the generateBudgetAlert function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BudgetAlertInputSchema = z.object({
  category: z.string().describe('The category of expense.'),
  spentAmount: z.number().describe('The amount spent in the category.'),
  budgetLimit: z.number().describe('The budget limit for the category.'),
  userName: z.string().describe('The name of the user.'),
});

export type BudgetAlertInput = z.infer<typeof BudgetAlertInputSchema>;

const BudgetAlertOutputSchema = z.object({
  alertMessage: z.string().describe('The generated budget alert message.'),
});

export type BudgetAlertOutput = z.infer<typeof BudgetAlertOutputSchema>;

export async function generateBudgetAlert(input: BudgetAlertInput): Promise<BudgetAlertOutput> {
  return budgetAlertFlow(input);
}

const budgetAlertPrompt = ai.definePrompt({
  name: 'budgetAlertPrompt',
  input: {schema: BudgetAlertInputSchema},
  output: {schema: BudgetAlertOutputSchema},
  prompt: `{{userName}}, you have spent {{spentAmount}} in the {{category}} category, exceeding your budget limit of {{budgetLimit}}. Consider reducing spending in this area. This is a budget alert message.`,
});

const budgetAlertFlow = ai.defineFlow(
  {
    name: 'budgetAlertFlow',
    inputSchema: BudgetAlertInputSchema,
    outputSchema: BudgetAlertOutputSchema,
  },
  async input => {
    const {output} = await budgetAlertPrompt(input);
    return output!;
  }
);
