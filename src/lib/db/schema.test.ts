import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const migrationsDir = join(projectRoot, "migrations");
const wranglerPath = join(projectRoot, "wrangler.jsonc");

function readMigrationSql(): string {
	const migrationFile = readdirSync(migrationsDir).find((name) => name.endsWith("_create_users_table.sql"));
	if (!migrationFile) {
		throw new Error("Migration file matching *_create_users_table.sql not found");
	}
	return readFileSync(join(migrationsDir, migrationFile), "utf-8");
}

function readWranglerConfig(): string {
	return readFileSync(wranglerPath, "utf-8");
}

describe("users database schema", () => {
	it("migration file exists", () => {
		const files = readdirSync(migrationsDir);
		expect(files.some((name) => name.endsWith("_create_users_table.sql"))).toBe(true);
	});

	it("users table DDL contains all required columns", () => {
		const sql = readMigrationSql();
		expect(sql).toMatch(/CREATE TABLE users/i);
		for (const column of [
			"id",
			"first_name",
			"last_name",
			"username",
			"email",
			"password_hash",
			"created_at",
			"updated_at",
		]) {
			expect(sql).toContain(column);
		}
	});

	it("defines uniqueness indexes on username and email", () => {
		const sql = readMigrationSql();
		expect(sql).toContain("idx_users_username");
		expect(sql).toContain("idx_users_email");
	});

	it("wrangler.jsonc includes d1_databases binding for quizmaker-db", () => {
		const config = readWranglerConfig();
		expect(config).toContain('"d1_databases"');
		expect(config).toContain('"binding": "DB"');
		expect(config).toContain('"database_name": "quizmaker-db"');
	});
});
