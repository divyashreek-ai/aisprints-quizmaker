import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ID_KEY } from "@/lib/auth/session";
import { SignupForm } from "@/components/signup-form";

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

describe("SignupForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 201,
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

	it("renders all registration fields", () => {
		render(<SignupForm />);

		expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
	});

	it("submits to register API and redirects to mcq on success", async () => {
		const user = userEvent.setup();
		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Doe");
		await user.type(screen.getByLabelText(/^username$/i), "janedoe");
		await user.type(screen.getByLabelText(/^email$/i), "jane@example.com");
		await user.type(screen.getByLabelText(/^password$/i), "securePass123");
		await user.type(screen.getByLabelText(/confirm password/i), "securePass123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({ method: "POST" }));
		});
		expect(mockPush).toHaveBeenCalledWith("/mcq");
		expect(sessionStorage.getItem(USER_ID_KEY)).toBe("user-1");
	});

	it("shows an error message on 409 response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 409,
				json: async () => ({ error: "Username already taken" }),
			}),
		);

		const user = userEvent.setup();
		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Doe");
		await user.type(screen.getByLabelText(/^username$/i), "janedoe");
		await user.type(screen.getByLabelText(/^email$/i), "jane@example.com");
		await user.type(screen.getByLabelText(/^password$/i), "securePass123");
		await user.type(screen.getByLabelText(/confirm password/i), "securePass123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent("Username already taken");
		expect(mockPush).not.toHaveBeenCalled();
	});
});
