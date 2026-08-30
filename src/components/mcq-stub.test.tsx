import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqStub } from "@/components/mcq-stub";

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

describe("McqStub", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			}),
		);
		sessionStorage.clear();
	});

	it("shows coming soon placeholder content", () => {
		render(<McqStub />);

		expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
	});

	it("logs out via API and navigates to login", async () => {
		const user = userEvent.setup();
		render(<McqStub />);

		await user.click(screen.getByRole("button", { name: /log out/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
		});
		expect(mockPush).toHaveBeenCalledWith("/login");
	});
});
