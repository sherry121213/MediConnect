// Symptom checker flow to analyze symptoms and suggest lab tests and specialists.
'use server';

/**
 * @fileOverview AI-driven symptom checker for suggesting lab tests or specialists.
 *
 * - aiSymptomChecker - A function that handles the symptom analysis process.
 * - AISymptomCheckerInput - The input type for the aiSymptomChecker function.
 * - AISymptomCheckerOutput - The return type for the aiSymptomChecker function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AISymptomCheckerInputSchema = z.object({
  symptoms: z
    .string()
    .describe('A detailed description of the patient\'s symptoms.'),
});
export type AISymptomCheckerInput = z.infer<typeof AISymptomCheckerInputSchema>;

const AISymptomCheckerOutputSchema = z.object({
  suggestedLabTests: z
    .string()
    .describe('A list of potential lab tests that may be relevant.'),
  relevantMedicalSpecialists: z
    .string()
    .describe('A list of medical specialists who could assist the patient.'),
});
export type AISymptomCheckerOutput = z.infer<typeof AISymptomCheckerOutputSchema>;

export async function aiSymptomChecker(input: AISymptomCheckerInput): Promise<AISymptomCheckerOutput> {
  return aiSymptomCheckerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiSymptomCheckerPrompt',
  input: {schema: AISymptomCheckerInputSchema},
  output: {schema: AISymptomCheckerOutputSchema},
  prompt: `You are an AI assistant designed to analyze patient symptoms and suggest potential lab tests and relevant medical specialists.

  Analyze the following symptoms:
  {{symptoms}}

  Based on these symptoms, provide a list of potential lab tests that may be relevant and a list of medical specialists who could assist the patient.
  Format your output in a structured manner.`,
});

const aiSymptomCheckerFlow = ai.defineFlow(
  {
    name: 'aiSymptomCheckerFlow',
    inputSchema: AISymptomCheckerInputSchema,
    outputSchema: AISymptomCheckerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
