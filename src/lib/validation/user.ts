import { z } from "zod";

export const registerSchema = z
	.object({
		firstName: z.string().trim().min(1).max(100),
		lastName: z.string().trim().min(1).max(100),
		username: z
			.string()
			.trim()
			.regex(/^[a-zA-Z0-9_]{3,30}$/, "Username must be 3-30 characters and use letters, numbers, or underscores"),
		email: z.string().trim().email().max(255),
		password: z.string().min(8).max(128),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export const loginSchema = z.object({
	username: z.string().trim().min(1),
	password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
