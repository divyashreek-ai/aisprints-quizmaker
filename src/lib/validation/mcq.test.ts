import { describe, expect, it } from "vitest";
import { attemptSchema, createMcqSchema, updateMcqSchema } from "./mcq";

const validChoice = { choiceText: "Austin", isCorrect: true };
const validChoiceTwo = { choiceText: "Dallas", isCorrect: false };

const validCreatePayload = {
	name: "Chapter 1 Review",
	question: "What is the capital of Texas?",
	createdByUserId: "user-id-1",
	choices: [validChoice, validChoiceTwo],
};

describe("createMcqSchema", () => {
	it("accepts valid payload with 2 to 6 choices and one correct", () => {
		const twoChoices = createMcqSchema.safeParse(validCreatePayload);
		const sixChoices = createMcqSchema.safeParse({
			...validCreatePayload,
			choices: [
				{ choiceText: "A", isCorrect: true },
				{ choiceText: "B", isCorrect: false },
				{ choiceText: "C", isCorrect: false },
				{ choiceText: "D", isCorrect: false },
				{ choiceText: "E", isCorrect: false },
				{ choiceText: "F", isCorrect: false },
			],
		});

		expect(twoChoices.success).toBe(true);
		expect(sixChoices.success).toBe(true);
	});

	it("rejects too few or too many choices", () => {
		const oneChoice = createMcqSchema.safeParse({
			...validCreatePayload,
			choices: [{ choiceText: "Only one", isCorrect: true }],
		});
		const sevenChoices = createMcqSchema.safeParse({
			...validCreatePayload,
			choices: [
				{ choiceText: "A", isCorrect: true },
				{ choiceText: "B", isCorrect: false },
				{ choiceText: "C", isCorrect: false },
				{ choiceText: "D", isCorrect: false },
				{ choiceText: "E", isCorrect: false },
				{ choiceText: "F", isCorrect: false },
				{ choiceText: "G", isCorrect: false },
			],
		});

		expect(oneChoice.success).toBe(false);
		expect(sevenChoices.success).toBe(false);
	});

	it("rejects zero or multiple correct choices", () => {
		const noneCorrect = createMcqSchema.safeParse({
			...validCreatePayload,
			choices: [
				{ choiceText: "A", isCorrect: false },
				{ choiceText: "B", isCorrect: false },
			],
		});
		const multipleCorrect = createMcqSchema.safeParse({
			...validCreatePayload,
			choices: [
				{ choiceText: "A", isCorrect: true },
				{ choiceText: "B", isCorrect: true },
			],
		});

		expect(noneCorrect.success).toBe(false);
		expect(multipleCorrect.success).toBe(false);
	});

	it("rejects empty name or question", () => {
		const emptyName = createMcqSchema.safeParse({
			...validCreatePayload,
			name: "   ",
		});
		const emptyQuestion = createMcqSchema.safeParse({
			...validCreatePayload,
			question: "",
		});
		const emptyUserId = createMcqSchema.safeParse({
			...validCreatePayload,
			createdByUserId: "",
		});

		expect(emptyName.success).toBe(false);
		expect(emptyQuestion.success).toBe(false);
		expect(emptyUserId.success).toBe(false);
	});
});

describe("updateMcqSchema", () => {
	it("accepts valid payload without createdByUserId", () => {
		const result = updateMcqSchema.safeParse({
			name: "Chapter 1 Review",
			question: "What is the capital of Texas?",
			choices: [validChoice, validChoiceTwo],
		});

		expect(result.success).toBe(true);
	});
});

describe("attemptSchema", () => {
	it("accepts valid choiceId", () => {
		const result = attemptSchema.safeParse({ choiceId: "choice-id-1" });
		expect(result.success).toBe(true);
	});

	it("rejects missing choiceId", () => {
		const missing = attemptSchema.safeParse({});
		const empty = attemptSchema.safeParse({ choiceId: "   " });

		expect(missing.success).toBe(false);
		expect(empty.success).toBe(false);
	});
});
