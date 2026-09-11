import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqPreview } from "@/components/mcq-preview";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
	}),
}));

vi.mock("next/link", () => ({
	default: ({ href, children }: { href: string; children: React.ReactNode }) => (
		<a href={href}>{children}</a>
	),
}));

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

function createFetchMock(isCorrect = true) {
	return vi.fn(async (url: string, options?: RequestInit) => {
		if (url === "/api/mcqs/mcq-1" && (!options?.method || options.method === "GET")) {
			return {
				ok: true,
				json: async () => ({ mcq: mcqWithChoices }),
			};
		}

		if (url === "/api/mcqs/mcq-1/attempts" && options?.method === "POST") {
			return {
				ok: true,
				status: 201,
				json: async () => ({
					attempt: {
						id: "attempt-1",
						mcqId: "mcq-1",
						choiceId: "choice-1",
						isCorrect,
						createdAt: "2026-09-10 01:00:00",
					},
				}),
			};
		}

		throw new Error(`Unhandled fetch: ${url} ${options?.method ?? "GET"}`);
	});
}

describe("McqPreview", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", createFetchMock(true));
	});

	it("renders the question and choices", async () => {
		render(<McqPreview mcqId="mcq-1" />);

		await waitFor(() => {
			expect(screen.getByText("What is the capital of Texas?")).toBeInTheDocument();
		});

		expect(screen.getByLabelText("Austin")).toBeInTheDocument();
		expect(screen.getByLabelText("Dallas")).toBeInTheDocument();
	});

	it("posts an attempt when an answer is submitted", async () => {
		const user = userEvent.setup();
		render(<McqPreview mcqId="mcq-1" />);

		await waitFor(() => {
			expect(screen.getByLabelText("Austin")).toBeInTheDocument();
		});

		await user.click(screen.getByLabelText("Austin"));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				"/api/mcqs/mcq-1/attempts",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ choiceId: "choice-1" }),
				}),
			);
		});
	});

	it("shows a correct result after a successful attempt", async () => {
		const user = userEvent.setup();
		render(<McqPreview mcqId="mcq-1" />);

		await waitFor(() => {
			expect(screen.getByLabelText("Austin")).toBeInTheDocument();
		});

		await user.click(screen.getByLabelText("Austin"));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		expect(await screen.findByText(/correct/i)).toBeInTheDocument();
	});

	it("shows an incorrect result after a wrong attempt", async () => {
		vi.stubGlobal("fetch", createFetchMock(false));
		const user = userEvent.setup();
		render(<McqPreview mcqId="mcq-1" />);

		await waitFor(() => {
			expect(screen.getByLabelText("Dallas")).toBeInTheDocument();
		});

		await user.click(screen.getByLabelText("Dallas"));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		expect(await screen.findByText(/incorrect/i)).toBeInTheDocument();
	});
});
