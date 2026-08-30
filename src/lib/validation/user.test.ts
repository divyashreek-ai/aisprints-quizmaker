import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./user";

const validRegisterPayload = {
	firstName: "Jane",
	lastName: "Doe",
	username: "janedoe",
	email: "jane@example.com",
	password: "securePass123",
	confirmPassword: "securePass123",
};

describe("registerSchema", () => {
	it("accepts valid payload", () => {
		const result = registerSchema.safeParse(validRegisterPayload);
		expect(result.success).toBe(true);
	});

	it("rejects password mismatch", () => {
		const result = registerSchema.safeParse({
			...validRegisterPayload,
			confirmPassword: "differentPass",
		});
		expect(result.success).toBe(false);
	});

	it("rejects short username and weak password", () => {
		const shortUsername = registerSchema.safeParse({
			...validRegisterPayload,
			username: "ab",
		});
		const weakPassword = registerSchema.safeParse({
			...validRegisterPayload,
			password: "short",
			confirmPassword: "short",
		});

		expect(shortUsername.success).toBe(false);
		expect(weakPassword.success).toBe(false);
	});
});

describe("loginSchema", () => {
	it("accepts valid payload", () => {
		const result = loginSchema.safeParse({
			username: "janedoe",
			password: "securePass123",
		});
		expect(result.success).toBe(true);
	});

	it("rejects missing fields", () => {
		const result = loginSchema.safeParse({ username: "janedoe" });
		expect(result.success).toBe(false);
	});
});
