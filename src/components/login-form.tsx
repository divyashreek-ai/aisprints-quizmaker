"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loginSchema } from "@/lib/validation/user";

const DISPLAY_NAME_KEY = "quizmaker.displayName";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		const formData = new FormData(event.currentTarget);
		const payload = {
			username: String(formData.get("username") ?? ""),
			password: String(formData.get("password") ?? ""),
		};

		const parsed = loginSchema.safeParse(payload);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Validation failed");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(parsed.data),
			});

			const data = (await response.json()) as {
				error?: string;
				user?: { firstName: string; lastName: string };
			};

			if (!response.ok) {
				setError(data.error ?? "Invalid username or password");
				return;
			}

			if (data.user) {
				sessionStorage.setItem(
					DISPLAY_NAME_KEY,
					`${data.user.firstName} ${data.user.lastName}`.trim(),
				);
			}

			router.push("/mcq");
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>Login to your account</CardTitle>
					<CardDescription>
						Enter your username below to login to your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="username">Username</FieldLabel>
								<Input
									id="username"
									name="username"
									type="text"
									placeholder="janedoe"
									autoComplete="username"
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<Input
									id="password"
									name="password"
									type="password"
									autoComplete="current-password"
									required
								/>
							</Field>
							{error ? <FieldError>{error}</FieldError> : null}
							<Field>
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Logging in…" : "Login"}
								</Button>
								<FieldDescription className="text-center">
									Don&apos;t have an account? <Link href="/register">Sign up</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
