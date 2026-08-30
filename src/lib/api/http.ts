import type { ZodError } from "zod";

export async function parseJsonBody(request: Request): Promise<unknown | null> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

export function validationErrorResponse(error: ZodError) {
	return Response.json(
		{
			error: "Validation failed",
			details: error.issues.map((issue) => ({
				path: issue.path,
				message: issue.message,
			})),
		},
		{ status: 400 },
	);
}

export function invalidRequestBodyResponse() {
	return Response.json({ error: "Invalid request body" }, { status: 400 });
}

export function internalServerErrorResponse() {
	return Response.json({ error: "Internal server error" }, { status: 500 });
}
