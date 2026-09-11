import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateMcqInput, UpdateMcqInput } from "@/lib/types/mcq";
import {
	createMcqService,
	InvalidMcqChoicesError,
	UserNotFoundError,
} from "./mcq-service";

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

const mcqRow: McqRow = {
	id: "mcq-id-1",
	name: "Chapter 1 Review",
	question: "What is the capital of Texas?",
	created_by_user_id: "user-id-1",
	created_at: "2026-09-10 00:00:00",
	updated_at: "2026-09-10 00:00:00",
};

const choiceRows: ChoiceRow[] = [
	{
		id: "choice-id-1",
		mcq_id: "mcq-id-1",
		choice_text: "Austin",
		is_correct: 1,
		position: 0,
		created_at: "2026-09-10 00:00:00",
		updated_at: "2026-09-10 00:00:00",
	},
	{
		id: "choice-id-2",
		mcq_id: "mcq-id-1",
		choice_text: "Dallas",
		is_correct: 0,
		position: 1,
		created_at: "2026-09-10 00:00:00",
		updated_at: "2026-09-10 00:00:00",
	},
];

const createInput: CreateMcqInput = {
	name: "Chapter 1 Review",
	question: "What is the capital of Texas?",
	createdByUserId: "user-id-1",
	choices: [
		{ choiceText: "Austin", isCorrect: true },
		{ choiceText: "Dallas", isCorrect: false },
	],
};

const updateInput: UpdateMcqInput = {
	name: "Chapter 1 Review (Updated)",
	question: "What is the capital of Texas?",
	choices: [
		{ choiceText: "Austin", isCorrect: true },
		{ choiceText: "Houston", isCorrect: false },
	],
};

function toMcqWithChoices(row: McqRow, choices: ChoiceRow[]) {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		createdByUserId: row.created_by_user_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		choices: choices.map((choice) => ({
			id: choice.id,
			choiceText: choice.choice_text,
			isCorrect: choice.is_correct === 1,
			position: choice.position,
		})),
	};
}

function createMockDb() {
	const all = vi.fn();
	const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
	const createQueryChain = () => {
		const chain = {
			all,
			run,
			bind: vi.fn(() => chain),
		};
		return chain;
	};
	const prepare = vi.fn(() => createQueryChain());
	const batch = vi.fn(async () => []);

	return {
		db: { prepare, batch } as unknown as D1Database,
		prepare,
		all,
		run,
		batch,
	};
}

describe("mcq service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("listMcqs returns summaries ordered by created_at desc", async () => {
		const { db, all } = createMockDb();
		const secondRow: McqRow = {
			...mcqRow,
			id: "mcq-id-2",
			name: "Chapter 2 Review",
			created_at: "2026-09-11 00:00:00",
			updated_at: "2026-09-11 00:00:00",
		};

		all.mockResolvedValueOnce({ results: [secondRow, mcqRow] });

		const service = createMcqService(db);
		const mcqs = await service.listMcqs();

		expect(mcqs).toEqual([
			{
				id: "mcq-id-2",
				name: "Chapter 2 Review",
				question: mcqRow.question,
				createdByUserId: "user-id-1",
				createdAt: "2026-09-11 00:00:00",
				updatedAt: "2026-09-11 00:00:00",
			},
			{
				id: "mcq-id-1",
				name: mcqRow.name,
				question: mcqRow.question,
				createdByUserId: "user-id-1",
				createdAt: "2026-09-10 00:00:00",
				updatedAt: "2026-09-10 00:00:00",
			},
		]);
	});

	it("getMcqById returns MCQ with choices sorted by position when found", async () => {
		const { db, all } = createMockDb();

		all.mockResolvedValueOnce({ results: [mcqRow] }).mockResolvedValueOnce({
			results: choiceRows,
		});

		const service = createMcqService(db);
		const mcq = await service.getMcqById("mcq-id-1");

		expect(mcq).toEqual(toMcqWithChoices(mcqRow, choiceRows));
	});

	it("getMcqById returns null when not found", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [] });

		const service = createMcqService(db);
		const mcq = await service.getMcqById("missing-id");

		expect(mcq).toBeNull();
	});

	it("createMcq inserts MCQ and choices and returns full object", async () => {
		const { db, all, run, batch } = createMockDb();

		all
			.mockResolvedValueOnce({ results: [{ id: "user-id-1" }] })
			.mockResolvedValueOnce({ results: [{ id: "mcq-id-1" }] })
			.mockResolvedValueOnce({ results: [mcqRow] })
			.mockResolvedValueOnce({ results: choiceRows });

		run.mockResolvedValueOnce({ success: true, meta: { changes: 1 } });
		batch.mockResolvedValueOnce([]);

		const service = createMcqService(db);
		const mcq = await service.createMcq(createInput);

		expect(mcq).toEqual(toMcqWithChoices(mcqRow, choiceRows));

		const insertMcqCall = vi.mocked(db.prepare).mock.calls.find(([sql]) =>
			String(sql).toLowerCase().includes("insert into mcqs"),
		);
		expect(insertMcqCall).toBeDefined();
		expect(batch).toHaveBeenCalled();
	});

	it("createMcq rejects when createdByUserId is missing from users", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [] });

		const service = createMcqService(db);

		await expect(service.createMcq(createInput)).rejects.toBeInstanceOf(UserNotFoundError);
	});

	it("createMcq rejects invalid choice rules", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [{ id: "user-id-1" }] });

		const service = createMcqService(db);

		await expect(
			service.createMcq({
				...createInput,
				choices: [{ choiceText: "Only one", isCorrect: true }],
			}),
		).rejects.toBeInstanceOf(InvalidMcqChoicesError);

		await expect(
			service.createMcq({
				...createInput,
				choices: [
					{ choiceText: "A", isCorrect: false },
					{ choiceText: "B", isCorrect: false },
				],
			}),
		).rejects.toBeInstanceOf(InvalidMcqChoicesError);
	});

	it("updateMcq updates fields and replaces choices", async () => {
		const { db, all, run, batch } = createMockDb();
		const updatedRow: McqRow = {
			...mcqRow,
			name: updateInput.name,
			updated_at: "2026-09-10 01:00:00",
		};
		const updatedChoices: ChoiceRow[] = [
			{ ...choiceRows[0], choice_text: "Austin" },
			{
				...choiceRows[1],
				id: "choice-id-3",
				choice_text: "Houston",
			},
		];

		all
			.mockResolvedValueOnce({ results: [mcqRow] })
			.mockResolvedValueOnce({ results: [updatedRow] })
			.mockResolvedValueOnce({ results: updatedChoices });

		run.mockResolvedValue({ success: true, meta: { changes: 1 } });
		batch.mockResolvedValueOnce([]);

		const service = createMcqService(db);
		const mcq = await service.updateMcq("mcq-id-1", updateInput);

		expect(mcq).toEqual(toMcqWithChoices(updatedRow, updatedChoices));

		const deleteChoicesCall = vi.mocked(db.prepare).mock.calls.find(([sql]) =>
			String(sql).toLowerCase().includes("delete from mcq_choices"),
		);
		expect(deleteChoicesCall).toBeDefined();
	});

	it("updateMcq returns null when not found", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [] });

		const service = createMcqService(db);
		const mcq = await service.updateMcq("missing-id", updateInput);

		expect(mcq).toBeNull();
	});

	it("deleteMcq removes MCQ and returns true", async () => {
		const { db, all, run } = createMockDb();
		all.mockResolvedValueOnce({ results: [mcqRow] });
		run.mockResolvedValueOnce({ success: true, meta: { changes: 1 } });

		const service = createMcqService(db);
		const deleted = await service.deleteMcq("mcq-id-1");

		expect(deleted).toBe(true);

		const deleteCall = vi.mocked(db.prepare).mock.calls.find(([sql]) =>
			String(sql).toLowerCase().includes("delete from mcqs"),
		);
		expect(deleteCall).toBeDefined();
	});

	it("deleteMcq returns false when not found", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [] });

		const service = createMcqService(db);
		const deleted = await service.deleteMcq("missing-id");

		expect(deleted).toBe(false);
	});

	it("recordAttempt persists attempt with correct is_correct", async () => {
		const { db, all, run } = createMockDb();
		const attemptRow: AttemptRow = {
			id: "attempt-id-1",
			mcq_id: "mcq-id-1",
			choice_id: "choice-id-1",
			is_correct: 1,
			created_at: "2026-09-10 02:00:00",
		};

		all.mockResolvedValueOnce({ results: [choiceRows[0]] }).mockResolvedValueOnce({
			results: [attemptRow],
		});
		run.mockResolvedValueOnce({ success: true, meta: { changes: 1 } });

		const service = createMcqService(db);
		const attempt = await service.recordAttempt("mcq-id-1", "choice-id-1");

		expect(attempt).toEqual({
			id: "attempt-id-1",
			mcqId: "mcq-id-1",
			choiceId: "choice-id-1",
			isCorrect: true,
			createdAt: "2026-09-10 02:00:00",
		});
	});

	it("recordAttempt returns null when choice is not on MCQ", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [] });

		const service = createMcqService(db);
		const attempt = await service.recordAttempt("mcq-id-1", "missing-choice");

		expect(attempt).toBeNull();
	});
});
