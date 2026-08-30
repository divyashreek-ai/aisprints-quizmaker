import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	internalServerErrorResponse,
	invalidRequestBodyResponse,
	parseJsonBody,
	validationErrorResponse,
} from "@/lib/api/http";
import {
	createUserService,
	DuplicateEmailError,
	DuplicateUsernameError,
} from "@/lib/services/user-service";
import { registerSchema } from "@/lib/validation/user";

export async function POST(request: Request) {
	const body = await parseJsonBody(request);
	if (body === null) {
		return invalidRequestBodyResponse();
	}

	const parsed = registerSchema.safeParse(body);
	if (!parsed.success) {
		return validationErrorResponse(parsed.error);
	}

	try {
		const { env } = await getCloudflareContext();
		const userService = createUserService(env.DB);
		const user = await userService.createUser({
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			username: parsed.data.username,
			email: parsed.data.email,
			password: parsed.data.password,
		});

		return Response.json({ user }, { status: 201 });
	} catch (error) {
		if (error instanceof DuplicateUsernameError) {
			return Response.json({ error: "Username already taken" }, { status: 409 });
		}

		if (error instanceof DuplicateEmailError) {
			return Response.json({ error: "Email already registered" }, { status: 409 });
		}

		return internalServerErrorResponse();
	}
}
