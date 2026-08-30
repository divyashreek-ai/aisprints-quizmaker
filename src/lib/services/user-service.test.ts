import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createUserService,
	DuplicateEmailError,
	DuplicateUsernameError,
	type CreateUserInput,
} from "./user-service";

vi.mock("@/lib/auth/password", () => ({
	hashPassword: vi.fn(async (plain: string) => `pbkdf2-sha256$100000$salt$${plain}-hashed`),
	verifyPassword: vi.fn(async (plain: string, hash: string) => hash.includes(`${plain}-hashed`)),
}));

import { hashPassword, verifyPassword } from "@/lib/auth/password";

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
};

const sampleInput: CreateUserInput = {
	firstName: "Jane",
	lastName: "Doe",
	username: "janedoe",
	email: "Jane@Example.com",
	password: "plain-password-123",
};

const storedHash = "pbkdf2-sha256$100000$salt$plain-password-123-hashed";

const sampleRow: UserRow = {
	id: "user-id-1",
	first_name: "Jane",
	last_name: "Doe",
	username: "janedoe",
	email: "jane@example.com",
	password_hash: storedHash,
	created_at: "2026-08-30 00:00:00",
	updated_at: "2026-08-30 00:00:00",
};

function createMockDb() {
	const all = vi.fn();
	const run = vi.fn(async () => ({ success: true, meta: {} }));
	const bind = vi.fn(() => ({ all, run }));
	const prepare = vi.fn(() => ({ bind }));

	return {
		db: { prepare, batch: vi.fn() } as unknown as D1Database,
		prepare,
		bind,
		all,
		run,
	};
}

describe("user service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("createUser hashes plain password before insert and returns public user without hash", async () => {
		const { db, all, bind, prepare } = createMockDb();

		all
			.mockResolvedValueOnce({ results: [] })
			.mockResolvedValueOnce({ results: [] })
			.mockResolvedValueOnce({ results: [sampleRow] });

		const service = createUserService(db);
		const user = await service.createUser(sampleInput);

		expect(hashPassword).toHaveBeenCalledWith("plain-password-123");
		expect(user).toEqual({
			id: "user-id-1",
			firstName: "Jane",
			lastName: "Doe",
			username: "janedoe",
			email: "jane@example.com",
			createdAt: "2026-08-30 00:00:00",
			updatedAt: "2026-08-30 00:00:00",
		});
		expect(user).not.toHaveProperty("passwordHash");
		expect(user).not.toHaveProperty("password_hash");

		const insertBindArgs = bind.mock.calls.find((args) => args.includes(storedHash));
		expect(insertBindArgs).toBeDefined();
		const plainTextInsert = bind.mock.calls.find((args) => args.includes("plain-password-123"));
		expect(plainTextInsert).toBeUndefined();

		const insertCall = prepare.mock.calls.find(([sql]) =>
			String(sql).toLowerCase().includes("insert into users"),
		);
		expect(insertCall).toBeDefined();
	});

	it("createUser rejects duplicate username", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [sampleRow] });

		const service = createUserService(db);

		await expect(service.createUser(sampleInput)).rejects.toBeInstanceOf(DuplicateUsernameError);
	});

	it("createUser rejects duplicate email", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [] }).mockResolvedValueOnce({ results: [sampleRow] });

		const service = createUserService(db);

		await expect(service.createUser(sampleInput)).rejects.toBeInstanceOf(DuplicateEmailError);
	});

	it("getUserById returns user without password hash when found", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [sampleRow] });

		const service = createUserService(db);
		const user = await service.getUserById("user-id-1");

		expect(user).toEqual({
			id: "user-id-1",
			firstName: "Jane",
			lastName: "Doe",
			username: "janedoe",
			email: "jane@example.com",
			createdAt: "2026-08-30 00:00:00",
			updatedAt: "2026-08-30 00:00:00",
		});
	});

	it("getUserById returns null when not found", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [] });

		const service = createUserService(db);
		const user = await service.getUserById("missing-id");

		expect(user).toBeNull();
	});

	it("getUserByUsername returns row including passwordHash for internal use", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [sampleRow] });

		const service = createUserService(db);
		const user = await service.getUserByUsername("janedoe");

		expect(user).toEqual({
			id: "user-id-1",
			firstName: "Jane",
			lastName: "Doe",
			username: "janedoe",
			email: "jane@example.com",
			createdAt: "2026-08-30 00:00:00",
			updatedAt: "2026-08-30 00:00:00",
			passwordHash: storedHash,
		});
	});

	it("getUserByEmail returns public user or null", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [sampleRow] }).mockResolvedValueOnce({ results: [] });

		const service = createUserService(db);

		await expect(service.getUserByEmail("jane@example.com")).resolves.toEqual({
			id: "user-id-1",
			firstName: "Jane",
			lastName: "Doe",
			username: "janedoe",
			email: "jane@example.com",
			createdAt: "2026-08-30 00:00:00",
			updatedAt: "2026-08-30 00:00:00",
		});
		await expect(service.getUserByEmail("missing@example.com")).resolves.toBeNull();
	});

	it("verifyCredentials returns public user for valid credentials", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [sampleRow] });

		const service = createUserService(db);
		const user = await service.verifyCredentials("janedoe", "plain-password-123");

		expect(verifyPassword).toHaveBeenCalledWith("plain-password-123", storedHash);
		expect(user).toEqual({
			id: "user-id-1",
			firstName: "Jane",
			lastName: "Doe",
			username: "janedoe",
			email: "jane@example.com",
			createdAt: "2026-08-30 00:00:00",
			updatedAt: "2026-08-30 00:00:00",
		});
	});

	it("verifyCredentials returns null for wrong password", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [sampleRow] });

		const service = createUserService(db);
		const user = await service.verifyCredentials("janedoe", "wrong-password");

		expect(user).toBeNull();
	});

	it("verifyCredentials returns null for unknown user", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [] });

		const service = createUserService(db);
		const user = await service.verifyCredentials("unknown", "plain-password-123");

		expect(user).toBeNull();
	});

	it("updateUser updates names and updated_at", async () => {
		const { db, all } = createMockDb();
		const updatedRow: UserRow = {
			...sampleRow,
			first_name: "Janet",
			last_name: "Smith",
			updated_at: "2026-08-30 01:00:00",
		};

		all.mockResolvedValueOnce({ results: [updatedRow] });

		const service = createUserService(db);
		const user = await service.updateUser("user-id-1", {
			firstName: "Janet",
			lastName: "Smith",
		});

		expect(user).toEqual({
			id: "user-id-1",
			firstName: "Janet",
			lastName: "Smith",
			username: "janedoe",
			email: "jane@example.com",
			createdAt: "2026-08-30 00:00:00",
			updatedAt: "2026-08-30 01:00:00",
		});
	});

	it("deleteUser removes row", async () => {
		const { db, prepare, bind, run } = createMockDb();
		bind.mockReturnValue({ all: vi.fn(), run });

		const service = createUserService(db);
		await service.deleteUser("user-id-1");

		const deleteCall = prepare.mock.calls.find(([sql]) =>
			String(sql).toLowerCase().includes("delete from users"),
		);
		expect(deleteCall).toBeDefined();
	});
});
