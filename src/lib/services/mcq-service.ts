import type {
	AttemptResult,
	CreateMcqInput,
	McqChoice,
	McqChoiceInput,
	McqSummary,
	McqWithChoices,
	UpdateMcqInput,
} from "@/lib/types/mcq";

type McqRow = {
	id: string;
	name: string;
	question: string;
	created_by_user_id: string;
	created_at: string;
	updated_at: string;
};

type ChoiceRow = {
	id: string;
	mcq_id: string;
	choice_text: string;
	is_correct: number;
	position: number;
	created_at: string;
	updated_at: string;
};

type AttemptRow = {
	id: string;
	mcq_id: string;
	choice_id: string;
	is_correct: number;
	created_at: string;
};

export class UserNotFoundError extends Error {
	constructor() {
		super("User not found");
		this.name = "UserNotFoundError";
	}
}

export class InvalidMcqChoicesError extends Error {
	constructor() {
		super("MCQ must have 2 to 6 choices with exactly one marked correct");
		this.name = "InvalidMcqChoicesError";
	}
}

function normalizeText(value: string): string {
	return value.trim();
}

function toMcqSummary(row: McqRow): McqSummary {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		createdByUserId: row.created_by_user_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toMcqChoice(row: ChoiceRow): McqChoice {
	return {
		id: row.id,
		choiceText: row.choice_text,
		isCorrect: row.is_correct === 1,
		position: row.position,
	};
}

function toAttemptResult(row: AttemptRow): AttemptResult {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		choiceId: row.choice_id,
		isCorrect: row.is_correct === 1,
		createdAt: row.created_at,
	};
}

function validateChoices(choices: McqChoiceInput[]): void {
	if (choices.length < 2 || choices.length > 6) {
		throw new InvalidMcqChoicesError();
	}

	const correctCount = choices.filter((choice) => choice.isCorrect).length;
	if (correctCount !== 1) {
		throw new InvalidMcqChoicesError();
	}
}

export function createMcqService(db: D1Database) {
	async function getMcqRowById(id: string): Promise<McqRow | null> {
		const { results } = await db
			.prepare(
				`SELECT id, name, question, created_by_user_id, created_at, updated_at
         FROM mcqs
         WHERE id = ?1`,
			)
			.bind(id)
			.all<McqRow>();

		return results[0] ?? null;
	}

	async function getChoiceRowsByMcqId(mcqId: string): Promise<ChoiceRow[]> {
		const { results } = await db
			.prepare(
				`SELECT id, mcq_id, choice_text, is_correct, position, created_at, updated_at
         FROM mcq_choices
         WHERE mcq_id = ?1
         ORDER BY position ASC`,
			)
			.bind(mcqId)
			.all<ChoiceRow>();

		return results;
	}

	async function insertChoices(mcqId: string, choices: McqChoiceInput[]): Promise<void> {
		const statements = choices.map((choice, position) =>
			db
				.prepare(
					`INSERT INTO mcq_choices (mcq_id, choice_text, is_correct, position)
           VALUES (?1, ?2, ?3, ?4)`,
				)
				.bind(mcqId, normalizeText(choice.choiceText), choice.isCorrect ? 1 : 0, position),
		);

		await db.batch(statements);
	}

	return {
		async listMcqs(): Promise<McqSummary[]> {
			const { results } = await db
				.prepare(
					`SELECT id, name, question, created_by_user_id, created_at, updated_at
           FROM mcqs
           ORDER BY created_at DESC`,
				)
				.all<McqRow>();

			return results.map(toMcqSummary);
		},

		async getMcqById(id: string): Promise<McqWithChoices | null> {
			const row = await getMcqRowById(id);
			if (!row) {
				return null;
			}

			const choices = await getChoiceRowsByMcqId(id);
			return {
				...toMcqSummary(row),
				choices: choices.map(toMcqChoice),
			};
		},

		async createMcq(input: CreateMcqInput): Promise<McqWithChoices> {
			validateChoices(input.choices);

			const { results: userResults } = await db
				.prepare(`SELECT id FROM users WHERE id = ?1`)
				.bind(input.createdByUserId)
				.all<{ id: string }>();

			if (!userResults[0]) {
				throw new UserNotFoundError();
			}

			const name = normalizeText(input.name);
			const question = normalizeText(input.question);

			const { results: insertedMcqResults } = await db
				.prepare(
					`INSERT INTO mcqs (name, question, created_by_user_id)
           VALUES (?1, ?2, ?3)
           RETURNING id`,
				)
				.bind(name, question, input.createdByUserId)
				.all<{ id: string }>();

			const mcqId = insertedMcqResults[0]?.id;
			if (!mcqId) {
				throw new Error("Failed to create MCQ");
			}

			await insertChoices(mcqId, input.choices);

			const created = await this.getMcqById(mcqId);
			if (!created) {
				throw new Error("Failed to create MCQ");
			}

			return created;
		},

		async updateMcq(id: string, input: UpdateMcqInput): Promise<McqWithChoices | null> {
			const existing = await getMcqRowById(id);
			if (!existing) {
				return null;
			}

			validateChoices(input.choices);

			const name = normalizeText(input.name);
			const question = normalizeText(input.question);

			await db
				.prepare(
					`UPDATE mcqs
           SET name = ?1,
               question = ?2,
               updated_at = datetime('now')
           WHERE id = ?3`,
				)
				.bind(name, question, id)
				.run();

			await db.prepare(`DELETE FROM mcq_choices WHERE mcq_id = ?1`).bind(id).run();
			await insertChoices(id, input.choices);

			return this.getMcqById(id);
		},

		async deleteMcq(id: string): Promise<boolean> {
			const existing = await getMcqRowById(id);
			if (!existing) {
				return false;
			}

			await db.prepare(`DELETE FROM mcqs WHERE id = ?1`).bind(id).run();
			return true;
		},

		async recordAttempt(mcqId: string, choiceId: string): Promise<AttemptResult | null> {
			const { results: choiceResults } = await db
				.prepare(
					`SELECT id, mcq_id, choice_text, is_correct, position, created_at, updated_at
           FROM mcq_choices
           WHERE id = ?1 AND mcq_id = ?2`,
				)
				.bind(choiceId, mcqId)
				.all<ChoiceRow>();

			const choice = choiceResults[0];
			if (!choice) {
				return null;
			}

			const { results: attemptResults } = await db
				.prepare(
					`INSERT INTO mcq_attempts (mcq_id, choice_id, is_correct)
           VALUES (?1, ?2, ?3)
           RETURNING id, mcq_id, choice_id, is_correct, created_at`,
				)
				.bind(mcqId, choiceId, choice.is_correct)
				.all<AttemptRow>();

			const attempt = attemptResults[0];
			if (!attempt) {
				throw new Error("Failed to record attempt");
			}

			return toAttemptResult(attempt);
		},
	};
}
