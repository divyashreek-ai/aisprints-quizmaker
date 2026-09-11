import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqList, truncateQuestion } from "@/components/mcq-list";
import type { McqSummary } from "@/lib/types/mcq";

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

const sampleMcqs: McqSummary[] = [
	{
		id: "mcq-1",
		name: "Chapter 1 Review",
		question: "What is the capital of Texas?",
		createdByUserId: "user-1",
		createdAt: "2026-09-10 00:00:00",
		updatedAt: "2026-09-10 00:00:00",
	},
	{
		id: "mcq-2",
		name: "Long Question",
		question: `${"A".repeat(100)}?`,
		createdByUserId: "user-1",
		createdAt: "2026-09-10 01:00:00",
		updatedAt: "2026-09-10 01:00:00",
	},
];

function createFetchMock(mcqs: McqSummary[]) {
	return vi.fn(async (url: string, options?: RequestInit) => {
		if (url === "/api/mcqs" && (!options?.method || options.method === "GET")) {
			return {
				ok: true,
				json: async () => ({ mcqs }),
			};
		}

		if (url === "/api/mcqs/mcq-1" && options?.method === "DELETE") {
			return {
				ok: true,
				json: async () => ({ success: true }),
			};
		}

		if (url === "/api/auth/logout" && options?.method === "POST") {
			return {
				ok: true,
				json: async () => ({ success: true }),
			};
		}

		throw new Error(`Unhandled fetch: ${url} ${options?.method ?? "GET"}`);
	});
}

class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}

describe("McqList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
		vi.stubGlobal("fetch", createFetchMock(sampleMcqs));
		vi.stubGlobal("ResizeObserver", ResizeObserverMock);
		Element.prototype.getBoundingClientRect = vi.fn(() => ({
			width: 120,
			height: 40,
			top: 0,
			left: 0,
			bottom: 40,
			right: 120,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}));
	});

	it("renders table headers", async () => {
		render(<McqList />);

		await waitFor(() => {
			expect(screen.getByRole("columnheader", { name: /name/i })).toBeInTheDocument();
		});
		expect(screen.getByRole("columnheader", { name: /question/i })).toBeInTheDocument();
		expect(screen.getByRole("columnheader", { name: /actions/i })).toBeInTheDocument();
	});

	it("lists MCQs from API with truncated question text", async () => {
		render(<McqList />);

		await waitFor(() => {
			expect(screen.getByText("Chapter 1 Review")).toBeInTheDocument();
		});

		expect(screen.getByText("What is the capital of Texas?")).toBeInTheDocument();
		expect(screen.getByText(truncateQuestion(sampleMcqs[1].question))).toBeInTheDocument();
	});

	it("links Create MCQ button to /mcq/new", async () => {
		render(<McqList />);

		await waitFor(() => {
			expect(screen.getAllByRole("link", { name: /create mcq/i }).length).toBeGreaterThan(0);
		});

		for (const link of screen.getAllByRole("link", { name: /create mcq/i })) {
			expect(link).toHaveAttribute("href", "/mcq/new");
		}
	});

	it("shows Edit, Preview, and Delete actions in the row menu", async () => {
		const user = userEvent.setup();
		render(<McqList />);

		await waitFor(() => {
			expect(screen.getByText("Chapter 1 Review")).toBeInTheDocument();
		});

		await user.click(screen.getAllByRole("button", { name: /open actions menu/i })[0]);

		await waitFor(() => {
			expect(screen.getByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
		});

		expect(screen.getByRole("menuitem", { name: /^preview$/i })).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeInTheDocument();

		await user.click(screen.getByRole("menuitem", { name: /^edit$/i }));
		expect(mockPush).toHaveBeenCalledWith("/mcq/mcq-1/edit");
	});

	it("opens delete dialog and calls DELETE on confirm", async () => {
		const user = userEvent.setup();
		const fetchMock = createFetchMock(sampleMcqs);
		vi.stubGlobal("fetch", fetchMock);

		render(<McqList />);

		await waitFor(() => {
			expect(screen.getByText("Chapter 1 Review")).toBeInTheDocument();
		});

		await user.click(screen.getAllByRole("button", { name: /open actions menu/i })[0]);

		await waitFor(() => {
			expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeInTheDocument();
		});

		await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));

		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByText(/delete mcq/i)).toBeInTheDocument();

		await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/mcqs/mcq-1",
				expect.objectContaining({ method: "DELETE" }),
			);
		});
	});

	it("shows empty state when no MCQs exist", async () => {
		vi.stubGlobal("fetch", createFetchMock([]));

		render(<McqList />);

		await waitFor(() => {
			expect(screen.getByText(/no mcqs yet/i)).toBeInTheDocument();
		});
	});

	it("logs out via API and navigates to login", async () => {
		const user = userEvent.setup();
		render(<McqList />);

		await waitFor(() => {
			expect(screen.getByText("Chapter 1 Review")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /log out/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
		});
		expect(mockPush).toHaveBeenCalledWith("/login");
	});
});
