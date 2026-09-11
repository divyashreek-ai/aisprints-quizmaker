import { z } from "zod";

export const choiceSchema = z.object({
	choiceText: z.string().trim().min(1).max(500),
	isCorrect: z.boolean(),
});

const choicesArraySchema = z
	.array(choiceSchema)
	.min(2, "MCQ must have at least 2 choices")
	.max(6, "MCQ must have at most 6 choices")
	.refine((choices) => choices.filter((choice) => choice.isCorrect).length === 1, {
		message: "Exactly one choice must be marked correct",
	});

export const createMcqSchema = z.object({
	name: z.string().trim().min(1).max(200),
	question: z.string().trim().min(1).max(2000),
	createdByUserId: z.string().trim().min(1),
	choices: choicesArraySchema,
});

export const updateMcqSchema = z.object({
	name: z.string().trim().min(1).max(200),
	question: z.string().trim().min(1).max(2000),
	choices: choicesArraySchema,
});

export const attemptSchema = z.object({
	choiceId: z.string().trim().min(1),
});

export type CreateMcqSchemaInput = z.infer<typeof createMcqSchema>;
export type UpdateMcqSchemaInput = z.infer<typeof updateMcqSchema>;
export type AttemptSchemaInput = z.infer<typeof attemptSchema>;
