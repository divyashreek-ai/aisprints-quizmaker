import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createUserService,
	DuplicateEmailError,
	DuplicateUsernameError,
	type CreateUserInput,
} from "./user-service";

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
	passwordHash: "hashed-password-value",
};

const sampleRow: UserRow = {
	id: "user-id-1",
	first_name: "Jane",
	last_name: "Doe",
	username: "janedoe",
	email: "jane@example.com",
	password_hash: "hashed-password-value",
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

	it("createUser inserts row with supplied passwordHash and returns public user without hash", async () => {
		const { db, all, bind, prepare } = createMockDb();

		all
			.mockResolvedValueOnce({ results: [] })
			.mockResolvedValueOnce({ results: [] })
			.mockResolvedValueOnce({ results: [sampleRow] });

		const service = createUserService(db);
		const user = await service.createUser(sampleInput);

		expect(prepare).toHaveBeenCalled();
		expect(bind).toHaveBeenCalled();
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

		const insertCall = prepare.mock.calls.find(([sql]) =>
			String(sql).toLowerCase().includes("insert into users"),
		);
		expect(insertCall).toBeDefined();
		const insertBindArgs = bind.mock.calls.find((args) => args.includes("hashed-password-value"));
		expect(insertBindArgs).toBeDefined();
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
			passwordHash: "hashed-password-value",
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
