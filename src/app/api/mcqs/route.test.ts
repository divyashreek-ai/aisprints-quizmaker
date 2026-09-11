import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMcqService, UserNotFoundError } from "@/lib/services/mcq-service";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(),
}));

vi.mock("@/lib/services/mcq-service", async () => {
	const actual = await vi.importActual<typeof import("@/lib/services/mcq-service")>(
		"@/lib/services/mcq-service",
	);
	return {
		...actual,
		createMcqService: vi.fn(),
	};
});

import { GET, POST } from "@/app/api/mcqs/route";

const mcqSummary = {
	id: "mcq-1",
	name: "Chapter 1 Review",
	question: "What is the capital of Texas?",
	createdByUserId: "user-1",
	createdAt: "2026-09-10 00:00:00",
	updatedAt: "2026-09-10 00:00:00",
};

const mcqWithChoices = {
	...mcqSummary,
	choices: [
		{ id: "choice-1", choiceText: "Austin", isCorrect: true, position: 0 },
		{ id: "choice-2", choiceText: "Dallas", isCorrect: false, position: 1 },
	],
};

const validCreateBody = {
	name: "Chapter 1 Review",
	question: "What is the capital of Texas?",
	createdByUserId: "user-1",
	choices: [
		{ choiceText: "Austin", isCorrect: true },
		{ choiceText: "Dallas", isCorrect: false },
	],
};

function createPostRequest(body: unknown) {
	return new Request("http://localhost/api/mcqs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("/api/mcqs", () => {
	const listMcqs = vi.fn();
	const createMcq = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCloudflareContext).mockResolvedValue({
			env: { DB: {} as D1Database },
		} as Awaited<ReturnType<typeof getCloudflareContext>>);
		vi.mocked(createMcqService).mockReturnValue({
			listMcqs,
			createMcq,
		} as unknown as ReturnType<typeof createMcqService>);
	});

	describe("GET", () => {
		it("returns 200 with mcqs list", async () => {
			listMcqs.mockResolvedValue([mcqSummary]);

			const response = await GET();
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body.mcqs).toEqual([mcqSummary]);
		});
	});

	describe("POST", () => {
		it("returns 201 with created mcq for valid body", async () => {
			createMcq.mockResolvedValue(mcqWithChoices);

			const response = await POST(createPostRequest(validCreateBody));
			const body = await response.json();

			expect(response.status).toBe(201);
			expect(body.mcq).toEqual(mcqWithChoices);
			expect(createMcq).toHaveBeenCalledWith(validCreateBody);
		});

		it("returns 400 for validation errors", async () => {
			const response = await POST(
				createPostRequest({
					...validCreateBody,
					choices: [{ choiceText: "Only one", isCorrect: true }],
				}),
			);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.error).toBe("Validation failed");
			expect(createMcq).not.toHaveBeenCalled();
		});

		it("returns 404 when user is not found", async () => {
			createMcq.mockRejectedValue(new UserNotFoundError());

			const response = await POST(createPostRequest(validCreateBody));
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body.error).toBe("User not found");
		});
	});
});
