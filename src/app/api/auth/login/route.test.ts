import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createUserService } from "@/lib/services/user-service";

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

import { POST } from "@/app/api/auth/login/route";

const publicUser = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Doe",
	username: "janedoe",
	email: "jane@example.com",
	createdAt: "2026-08-30T00:00:00.000Z",
	updatedAt: "2026-08-30T00:00:00.000Z",
};

function createRequest(body: unknown) {
	return new Request("http://localhost/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/login", () => {
	const verifyCredentials = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCloudflareContext).mockResolvedValue({
			env: { DB: {} as D1Database },
		} as Awaited<ReturnType<typeof getCloudflareContext>>);
		vi.mocked(createUserService).mockReturnValue({
			verifyCredentials,
		} as unknown as ReturnType<typeof createUserService>);
	});

	it("returns 200 with user for valid credentials", async () => {
		verifyCredentials.mockResolvedValue(publicUser);

		const response = await POST(
			createRequest({
				username: "janedoe",
				password: "securePass123",
			}),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.user).toEqual(publicUser);
		expect(verifyCredentials).toHaveBeenCalledWith("janedoe", "securePass123");
	});

	it("returns 401 with generic message for invalid credentials", async () => {
		verifyCredentials.mockResolvedValue(null);

		const response = await POST(
			createRequest({
				username: "janedoe",
				password: "wrongPass123",
			}),
		);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.error).toBe("Invalid username or password");
	});

	it("returns 400 for validation errors", async () => {
		const response = await POST(createRequest({ username: "janedoe" }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("Validation failed");
		expect(body.details).toBeDefined();
		expect(verifyCredentials).not.toHaveBeenCalled();
	});

	it("returns identical 401 message for unknown user and wrong password", async () => {
		verifyCredentials.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

		const unknownUserResponse = await POST(
			createRequest({
				username: "unknown",
				password: "securePass123",
			}),
		);
		const wrongPasswordResponse = await POST(
			createRequest({
				username: "janedoe",
				password: "wrongPass123",
			}),
		);

		const unknownBody = await unknownUserResponse.json();
		const wrongPasswordBody = await wrongPasswordResponse.json();

		expect(unknownUserResponse.status).toBe(401);
		expect(wrongPasswordResponse.status).toBe(401);
		expect(unknownBody.error).toBe("Invalid username or password");
		expect(wrongPasswordBody.error).toBe(unknownBody.error);
	});
});
