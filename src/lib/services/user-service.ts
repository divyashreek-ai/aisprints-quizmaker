import { hashPassword, verifyPassword } from "@/lib/auth/password";

export type PublicUser = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	createdAt: string;
	updatedAt: string;
};

export type UserWithPasswordHash = PublicUser & {
	passwordHash: string;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	password: string;
};

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

export class DuplicateUsernameError extends Error {
	constructor() {
		super("Username already taken");
		this.name = "DuplicateUsernameError";
	}
}

export class DuplicateEmailError extends Error {
	constructor() {
		super("Email already registered");
		this.name = "DuplicateEmailError";
	}
}

function toPublicUser(row: UserRow): PublicUser {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toUserWithPasswordHash(row: UserRow): UserWithPasswordHash {
	return {
		...toPublicUser(row),
		passwordHash: row.password_hash,
	};
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function normalizeUsername(username: string): string {
	return username.trim();
}

function normalizeName(name: string): string {
	return name.trim();
}

export function createUserService(db: D1Database) {
	async function getUserRowByUsername(username: string): Promise<UserRow | null> {
		const normalized = normalizeUsername(username);
		const { results } = await db
			.prepare(
				`SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at
         FROM users
         WHERE lower(username) = lower(?1)`,
			)
			.bind(normalized)
			.all<UserRow>();

		return results[0] ?? null;
	}

	async function getUserRowByEmail(email: string): Promise<UserRow | null> {
		const normalized = normalizeEmail(email);
		const { results } = await db
			.prepare(
				`SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at
         FROM users
         WHERE lower(email) = lower(?1)`,
			)
			.bind(normalized)
			.all<UserRow>();

		return results[0] ?? null;
	}

	return {
		async createUser(input: CreateUserInput): Promise<PublicUser> {
			const firstName = normalizeName(input.firstName);
			const lastName = normalizeName(input.lastName);
			const username = normalizeUsername(input.username);
			const email = normalizeEmail(input.email);

			if (await getUserRowByUsername(username)) {
				throw new DuplicateUsernameError();
			}

			if (await getUserRowByEmail(email)) {
				throw new DuplicateEmailError();
			}

			const passwordHash = await hashPassword(input.password);

			await db
				.prepare(
					`INSERT INTO users (first_name, last_name, username, email, password_hash)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
				)
					.bind(firstName, lastName, username, email, passwordHash)
				.run();

			const created = await getUserRowByUsername(username);
			if (!created) {
				throw new Error("Failed to create user");
			}

			return toPublicUser(created);
		},

		async getUserById(id: string): Promise<PublicUser | null> {
			const { results } = await db
				.prepare(
					`SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at
           FROM users
           WHERE id = ?1`,
				)
				.bind(id)
				.all<UserRow>();

			const row = results[0];
			return row ? toPublicUser(row) : null;
		},

		async getUserByUsername(username: string): Promise<UserWithPasswordHash | null> {
			const row = await getUserRowByUsername(username);
			return row ? toUserWithPasswordHash(row) : null;
		},

		async getUserByEmail(email: string): Promise<PublicUser | null> {
			const row = await getUserRowByEmail(email);
			return row ? toPublicUser(row) : null;
		},

		async updateUser(
			id: string,
			patch: Partial<Pick<PublicUser, "firstName" | "lastName">>,
		): Promise<PublicUser> {
			const firstName = patch.firstName !== undefined ? normalizeName(patch.firstName) : undefined;
			const lastName = patch.lastName !== undefined ? normalizeName(patch.lastName) : undefined;

			if (firstName === undefined && lastName === undefined) {
				const existing = await this.getUserById(id);
				if (!existing) {
					throw new Error("User not found");
				}
				return existing;
			}

			await db
				.prepare(
					`UPDATE users
           SET first_name = COALESCE(?1, first_name),
               last_name = COALESCE(?2, last_name),
               updated_at = datetime('now')
           WHERE id = ?3`,
				)
				.bind(firstName ?? null, lastName ?? null, id)
				.run();

			const updated = await this.getUserById(id);
			if (!updated) {
				throw new Error("User not found");
			}

			return updated;
		},

		async deleteUser(id: string): Promise<void> {
			await db.prepare(`DELETE FROM users WHERE id = ?1`).bind(id).run();
		},

		async verifyCredentials(username: string, password: string): Promise<PublicUser | null> {
			const row = await getUserRowByUsername(username);
			if (!row) {
				return null;
			}

			const valid = await verifyPassword(password, row.password_hash);
			if (!valid) {
				return null;
			}

			return toPublicUser(row);
		},
	};
}
