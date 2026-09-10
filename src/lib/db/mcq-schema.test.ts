import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const migrationPath = join(projectRoot, "migrations", "0002_create_mcq_tables.sql");

function readMigrationSql(): string {
	return readFileSync(migrationPath, "utf-8");
}

describe("MCQ database schema", () => {
	it("migration file exists", () => {
		expect(() => readMigrationSql()).not.toThrow();
	});

	it("mcqs table DDL contains all required columns", () => {
		const sql = readMigrationSql();
		expect(sql).toMatch(/CREATE TABLE mcqs/i);
		for (const column of [
			"id",
			"name",
			"question",
			"created_by_user_id",
			"created_at",
			"updated_at",
		]) {
			expect(sql).toContain(column);
		}
		expect(sql).toMatch(/FOREIGN KEY\s*\(created_by_user_id\)\s*REFERENCES users\(id\)/i);
	});

	it("mcq_choices table DDL contains required columns and cascade delete", () => {
		const sql = readMigrationSql();
		expect(sql).toMatch(/CREATE TABLE mcq_choices/i);
		for (const column of [
			"id",
			"mcq_id",
			"choice_text",
			"is_correct",
			"position",
			"created_at",
			"updated_at",
		]) {
			expect(sql).toContain(column);
		}
		expect(sql).toMatch(/FOREIGN KEY\s*\(mcq_id\)\s*REFERENCES mcqs\(id\)\s*ON DELETE CASCADE/i);
	});

	it("mcq_attempts table DDL contains required columns and foreign keys", () => {
		const sql = readMigrationSql();
		expect(sql).toMatch(/CREATE TABLE mcq_attempts/i);
		for (const column of ["id", "mcq_id", "choice_id", "is_correct", "created_at"]) {
			expect(sql).toContain(column);
		}
		expect(sql).toMatch(/FOREIGN KEY\s*\(mcq_id\)\s*REFERENCES mcqs\(id\)\s*ON DELETE CASCADE/i);
		expect(sql).toMatch(/FOREIGN KEY\s*\(choice_id\)\s*REFERENCES mcq_choices\(id\)/i);
	});

	it("defines indexes on foreign key columns", () => {
		const sql = readMigrationSql();
		expect(sql).toContain("idx_mcqs_created_by_user_id");
		expect(sql).toContain("idx_mcq_choices_mcq_id");
		expect(sql).toContain("idx_mcq_attempts_mcq_id");
	});
});
