import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
	it("hash returns encoded string matching pbkdf2-sha256 format and not plain input", async () => {
		const plain = "securePass123";
		const hash = await hashPassword(plain);

		expect(hash).toMatch(/^pbkdf2-sha256\$/);
		expect(hash).not.toBe(plain);
	});

	it("verify returns true for correct password", async () => {
		const plain = "securePass123";
		const hash = await hashPassword(plain);

		await expect(verifyPassword(plain, hash)).resolves.toBe(true);
	});

	it("verify returns false for wrong password", async () => {
		const hash = await hashPassword("securePass123");

		await expect(verifyPassword("wrongPass123", hash)).resolves.toBe(false);
	});

	it("uses unique salts for identical passwords", async () => {
		const plain = "securePass123";
		const hashOne = await hashPassword(plain);
		const hashTwo = await hashPassword(plain);

		expect(hashOne).not.toBe(hashTwo);
	});
});
