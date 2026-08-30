import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

vi.mock("next/link", () => ({
	default: ({ href, children }: { href: string; children: React.ReactNode }) => (
		<a href={href}>{children}</a>
	),
}));

describe("home page", () => {
	it("shows Register and Login links", () => {
		render(<Home />);

		expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute("href", "/register");
		expect(screen.getByRole("link", { name: /login/i })).toHaveAttribute("href", "/login");
	});
});
