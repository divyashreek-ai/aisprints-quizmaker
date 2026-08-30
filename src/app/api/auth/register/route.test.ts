import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	createUserService,
	DuplicateEmailError,
	DuplicateUsernameError,
} from "@/lib/services/user-service";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(),
}));

vi.mock("@/lib/services/user-service", async () => {
	const actual = await vi.importActual<typeof import("@/lib/services/user-service")>(
		"@/lib/services/user-service",
	);
	return {
		...actual,
		createUserService: vi.fn(),
	};
});

import { POST } from "@/app/api/auth/register/route";

const publicUser = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Doe",
	username: "janedoe",
	email: "jane@example.com",
	createdAt: "2026-08-30T00:00:00.000Z",
	updatedAt: "2026-08-30T00:00:00.000Z",
};

const validBody = {
	firstName: "Jane",
	lastName: "Doe",
	username: "janedoe",
	email: "jane@example.com",
	password: "securePass123",
	confirmPassword: "securePass123",
};

function createRequest(body: unknown) {
	return new Request("http://localhost/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/register", () => {
	const createUser = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCloudflareContext).mockResolvedValue({
			env: { DB: {} as D1Database },
		} as Awaited<ReturnType<typeof getCloudflareContext>>);
		vi.mocked(createUserService).mockReturnValue({
			createUser,
		} as unknown as ReturnType<typeof createUserService>);
	});

	it("returns 201 with user and no password fields for valid body", async () => {
		createUser.mockResolvedValue(publicUser);

		const response = await POST(createRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.user).toEqual(publicUser);
		expect(body.user).not.toHaveProperty("password");
		expect(body.user).not.toHaveProperty("passwordHash");
		expect(createUser).toHaveBeenCalledWith({
			firstName: "Jane",
			lastName: "Doe",
			username: "janedoe",
			email: "jane@example.com",
			password: "securePass123",
		});
	});

	it("returns 400 with validation details for invalid body", async () => {
		const response = await POST(
			createRequest({
				...validBody,
				password: "short",
				confirmPassword: "short",
			}),
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("Validation failed");
		expect(body.details).toBeDefined();
		expect(createUser).not.toHaveBeenCalled();
	});

	it("returns 409 when username is already taken", async () => {
		createUser.mockRejectedValue(new DuplicateUsernameError());

		const response = await POST(createRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body.error).toBe("Username already taken");
	});

	it("returns 409 when email is already registered", async () => {
		createUser.mockRejectedValue(new DuplicateEmailError());

		const response = await POST(createRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body.error).toBe("Email already registered");
	});

	it("returns 500 for unexpected service errors", async () => {
		createUser.mockRejectedValue(new Error("Database unavailable"));

		const response = await POST(createRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe("Internal server error");
	});
});
