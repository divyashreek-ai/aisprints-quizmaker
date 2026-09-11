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
import { DISPLAY_NAME_KEY, USER_ID_KEY } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation/user";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		const formData = new FormData(event.currentTarget);
		const payload = {
			firstName: String(formData.get("firstName") ?? ""),
			lastName: String(formData.get("lastName") ?? ""),
			username: String(formData.get("username") ?? ""),
			email: String(formData.get("email") ?? ""),
			password: String(formData.get("password") ?? ""),
			confirmPassword: String(formData.get("confirmPassword") ?? ""),
		};

		const parsed = registerSchema.safeParse(payload);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Validation failed");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(parsed.data),
			});

			const data = (await response.json()) as {
				error?: string;
				details?: Array<{ message: string }>;
				user?: { id: string; firstName: string; lastName: string };
			};

			if (!response.ok) {
				if (data.details?.length) {
					setError(data.details[0]?.message ?? data.error ?? "Registration failed");
				} else {
					setError(data.error ?? "Registration failed");
				}
				return;
			}

			if (data.user) {
				sessionStorage.setItem(
					DISPLAY_NAME_KEY,
					`${data.user.firstName} ${data.user.lastName}`.trim(),
				);
				sessionStorage.setItem(USER_ID_KEY, data.user.id);
			}

			router.push("/mcq");
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Card {...props}>
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>
					Enter your information below to create your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="firstName">First Name</FieldLabel>
							<Input id="firstName" name="firstName" type="text" placeholder="Jane" required />
						</Field>
						<Field>
							<FieldLabel htmlFor="lastName">Last Name</FieldLabel>
							<Input id="lastName" name="lastName" type="text" placeholder="Doe" required />
						</Field>
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
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="m@example.com"
								autoComplete="email"
								required
							/>
							<FieldDescription>
								We&apos;ll use this to contact you. We will not share your email with anyone
								else.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								required
							/>
							<FieldDescription>Must be at least 8 characters long.</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
							<Input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
								required
							/>
							<FieldDescription>Please confirm your password.</FieldDescription>
						</Field>
						{error ? <FieldError>{error}</FieldError> : null}
						<FieldGroup>
							<Field>
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Creating account…" : "Create Account"}
								</Button>
								<FieldDescription className="px-6 text-center">
									Already have an account? <Link href="/login">Sign in</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
