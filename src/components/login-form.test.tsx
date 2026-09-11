import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ID_KEY } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";

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

describe("LoginForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({
					user: {
						id: "user-1",
						firstName: "Jane",
						lastName: "Doe",
						username: "janedoe",
						email: "jane@example.com",
					},
				}),
			}),
		);
	});

	it("renders username and password fields", () => {
		render(<LoginForm />);

		expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
	});

	it("submits to login API and redirects to mcq on success", async () => {
		const user = userEvent.setup();
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/^username$/i), "janedoe");
		await user.type(screen.getByLabelText(/^password$/i), "securePass123");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
		});
		expect(mockPush).toHaveBeenCalledWith("/mcq");
		expect(sessionStorage.getItem(USER_ID_KEY)).toBe("user-1");
	});

	it("shows generic invalid-credentials message on 401", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: async () => ({ error: "Invalid username or password" }),
			}),
		);

		const user = userEvent.setup();
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/^username$/i), "janedoe");
		await user.type(screen.getByLabelText(/^password$/i), "wrongPass123");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
		expect(mockPush).not.toHaveBeenCalled();
	});
});
