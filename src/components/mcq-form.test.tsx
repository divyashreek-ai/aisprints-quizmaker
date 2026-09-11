import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ID_KEY } from "@/lib/auth/session";
import { McqForm } from "@/components/mcq-form";

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

function createFetchMock() {
	return vi.fn(async (url: string, options?: RequestInit) => {
		if (url === "/api/mcqs/mcq-1" && (!options?.method || options.method === "GET")) {
			return {
				ok: true,
				json: async () => ({ mcq: mcqWithChoices }),
			};
		}

		if (url === "/api/mcqs" && options?.method === "POST") {
			return {
				ok: true,
				status: 201,
				json: async () => ({ mcq: mcqWithChoices }),
			};
		}

		if (url === "/api/mcqs/mcq-1" && options?.method === "PUT") {
			return {
				ok: true,
				json: async () => ({ mcq: mcqWithChoices }),
			};
		}

		throw new Error(`Unhandled fetch: ${url} ${options?.method ?? "GET"}`);
	});
}

describe("McqForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
		sessionStorage.setItem(USER_ID_KEY, "user-1");
		vi.stubGlobal("fetch", createFetchMock());
	});

	it("renders two choices by default in create mode", () => {
		render(<McqForm mode="create" />);

		expect(screen.getByLabelText(/^choice 1$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^choice 2$/i)).toBeInTheDocument();
	});

	it("adds and removes choices between 2 and 6", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("button", { name: /add choice/i }));
		expect(screen.getByLabelText(/^choice 3$/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /remove choice 3/i }));
		expect(screen.queryByLabelText(/^choice 3$/i)).not.toBeInTheDocument();
	});

	it("requires exactly one correct choice before saving", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), "Chapter 1 Review");
		await user.type(screen.getByLabelText(/^question$/i), "What is the capital of Texas?");
		await user.type(screen.getByLabelText(/^choice 1$/i), "Austin");
		await user.type(screen.getByLabelText(/^choice 2$/i), "Dallas");
		await user.click(screen.getByLabelText(/mark choice 1 correct/i));

		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/exactly one choice must be marked correct/i);
		expect(fetch).not.toHaveBeenCalledWith("/api/mcqs", expect.objectContaining({ method: "POST" }));
	});

	it("submits POST in create mode and redirects to the list", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), "Chapter 1 Review");
		await user.type(screen.getByLabelText(/^question$/i), "What is the capital of Texas?");
		await user.type(screen.getByLabelText(/^choice 1$/i), "Austin");
		await user.type(screen.getByLabelText(/^choice 2$/i), "Dallas");
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				"/api/mcqs",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({
						name: "Chapter 1 Review",
						question: "What is the capital of Texas?",
						createdByUserId: "user-1",
						choices: [
							{ choiceText: "Austin", isCorrect: true },
							{ choiceText: "Dallas", isCorrect: false },
						],
					}),
				}),
			);
		});
		expect(mockPush).toHaveBeenCalledWith("/mcq");
	});

	it("loads existing MCQ and submits PUT in edit mode", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="edit" mcqId="mcq-1" />);

		await waitFor(() => {
			expect(screen.getByLabelText(/^name$/i)).toHaveValue("Chapter 1 Review");
		});

		await user.clear(screen.getByLabelText(/^name$/i));
		await user.type(screen.getByLabelText(/^name$/i), "Updated Review");
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				"/api/mcqs/mcq-1",
				expect.objectContaining({ method: "PUT" }),
			);
		});
		expect(mockPush).toHaveBeenCalledWith("/mcq");
	});

	it("navigates back to the list when cancel is clicked", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("button", { name: /cancel/i }));

		expect(mockPush).toHaveBeenCalledWith("/mcq");
	});
});
