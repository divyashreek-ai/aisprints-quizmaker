import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
	it("returns 200 with success true", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/logout", {
				method: "POST",
			}),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ success: true });
	});

	it("does not set session or token cookies", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/logout", {
				method: "POST",
			}),
		);

		const setCookie = response.headers.get("Set-Cookie");
		expect(setCookie).toBeNull();
	});
});
