import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMcqService } from "@/lib/services/mcq-service";

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

import { DELETE, GET, PUT } from "@/app/api/mcqs/[id]/route";

const mcqWithChoices = {
	id: "mcq-1",
	name: "Chapter 1 Review",
	question: "What is the capital of Texas?",
	createdByUserId: "user-1",
	createdAt: "2026-09-10 00:00:00",
	updatedAt: "2026-09-10 00:00:00",
	choices: [
		{ id: "choice-1", choiceText: "Austin", isCorrect: true, position: 0 },
		{ id: "choice-2", choiceText: "Dallas", isCorrect: false, position: 1 },
	],
};

const validUpdateBody = {
	name: "Chapter 1 Review (Updated)",
	question: "What is the capital of Texas?",
	choices: [
		{ choiceText: "Austin", isCorrect: true },
		{ choiceText: "Houston", isCorrect: false },
	],
};

function routeContext(id: string) {
	return { params: Promise.resolve({ id }) };
}

function createPutRequest(body: unknown) {
	return new Request("http://localhost/api/mcqs/mcq-1", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("/api/mcqs/[id]", () => {
	const getMcqById = vi.fn();
	const updateMcq = vi.fn();
	const deleteMcq = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCloudflareContext).mockResolvedValue({
			env: { DB: {} as D1Database },
		} as Awaited<ReturnType<typeof getCloudflareContext>>);
		vi.mocked(createMcqService).mockReturnValue({
			getMcqById,
			updateMcq,
			deleteMcq,
		} as unknown as ReturnType<typeof createMcqService>);
	});

	describe("GET", () => {
		it("returns 200 with mcq when found", async () => {
			getMcqById.mockResolvedValue(mcqWithChoices);

			const response = await GET(new Request("http://localhost/api/mcqs/mcq-1"), routeContext("mcq-1"));
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body.mcq).toEqual(mcqWithChoices);
		});

		it("returns 404 when not found", async () => {
			getMcqById.mockResolvedValue(null);

			const response = await GET(new Request("http://localhost/api/mcqs/missing"), routeContext("missing"));
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body.error).toBe("MCQ not found");
		});
	});

	describe("PUT", () => {
		it("returns 200 with updated mcq when found", async () => {
			updateMcq.mockResolvedValue(mcqWithChoices);

			const response = await PUT(createPutRequest(validUpdateBody), routeContext("mcq-1"));
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body.mcq).toEqual(mcqWithChoices);
			expect(updateMcq).toHaveBeenCalledWith("mcq-1", validUpdateBody);
		});

		it("returns 404 when not found", async () => {
			updateMcq.mockResolvedValue(null);

			const response = await PUT(createPutRequest(validUpdateBody), routeContext("missing"));
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body.error).toBe("MCQ not found");
		});

		it("returns 400 for validation errors", async () => {
			const response = await PUT(
				createPutRequest({
					...validUpdateBody,
					choices: [{ choiceText: "Only one", isCorrect: true }],
				}),
				routeContext("mcq-1"),
			);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.error).toBe("Validation failed");
			expect(updateMcq).not.toHaveBeenCalled();
		});
	});

	describe("DELETE", () => {
		it("returns 200 when deleted", async () => {
			deleteMcq.mockResolvedValue(true);

			const response = await DELETE(
				new Request("http://localhost/api/mcqs/mcq-1", { method: "DELETE" }),
				routeContext("mcq-1"),
			);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
		});

		it("returns 404 when not found", async () => {
			deleteMcq.mockResolvedValue(false);

			const response = await DELETE(
				new Request("http://localhost/api/mcqs/missing", { method: "DELETE" }),
				routeContext("missing"),
			);
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body.error).toBe("MCQ not found");
		});
	});
});
