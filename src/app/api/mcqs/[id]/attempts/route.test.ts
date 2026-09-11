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

import { POST } from "@/app/api/mcqs/[id]/attempts/route";

const attempt = {
	id: "attempt-1",
	mcqId: "mcq-1",
	choiceId: "choice-1",
	isCorrect: true,
	createdAt: "2026-09-10 01:00:00",
};

function routeContext(id: string) {
	return { params: Promise.resolve({ id }) };
}

function createPostRequest(body: unknown) {
	return new Request("http://localhost/api/mcqs/mcq-1/attempts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/mcqs/[id]/attempts", () => {
	const recordAttempt = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCloudflareContext).mockResolvedValue({
			env: { DB: {} as D1Database },
		} as Awaited<ReturnType<typeof getCloudflareContext>>);
		vi.mocked(createMcqService).mockReturnValue({
			recordAttempt,
		} as unknown as ReturnType<typeof createMcqService>);
	});

	it("returns 201 with attempt for valid body", async () => {
		recordAttempt.mockResolvedValue(attempt);

		const response = await POST(createPostRequest({ choiceId: "choice-1" }), routeContext("mcq-1"));
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.attempt).toEqual(attempt);
		expect(recordAttempt).toHaveBeenCalledWith("mcq-1", "choice-1");
	});

	it("returns 400 for validation errors", async () => {
		const response = await POST(createPostRequest({ choiceId: "   " }), routeContext("mcq-1"));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("Validation failed");
		expect(recordAttempt).not.toHaveBeenCalled();
	});

	it("returns 404 when mcq or choice is not found", async () => {
		recordAttempt.mockResolvedValue(null);

		const response = await POST(createPostRequest({ choiceId: "missing-choice" }), routeContext("mcq-1"));
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe("MCQ not found");
	});
});
