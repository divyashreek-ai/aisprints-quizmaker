import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	internalServerErrorResponse,
	invalidRequestBodyResponse,
	parseJsonBody,
	validationErrorResponse,
} from "@/lib/api/http";
import { createUserService } from "@/lib/services/user-service";
import { loginSchema } from "@/lib/validation/user";

export async function POST(request: Request) {
	const body = await parseJsonBody(request);
	if (body === null) {
		return invalidRequestBodyResponse();
	}

	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) {
		return validationErrorResponse(parsed.error);
	}

	try {
		const { env } = await getCloudflareContext();
		const userService = createUserService(env.DB);
		const user = await userService.verifyCredentials(parsed.data.username, parsed.data.password);

		if (!user) {
			return Response.json({ error: "Invalid username or password" }, { status: 401 });
		}

		return Response.json({ user });
	} catch {
		return internalServerErrorResponse();
	}
}
