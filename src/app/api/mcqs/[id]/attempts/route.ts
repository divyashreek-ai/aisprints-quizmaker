import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	internalServerErrorResponse,
	invalidRequestBodyResponse,
	parseJsonBody,
	validationErrorResponse,
} from "@/lib/api/http";
import { createMcqService } from "@/lib/services/mcq-service";
import { attemptSchema } from "@/lib/validation/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
	const { id } = await context.params;
	const body = await parseJsonBody(request);

	if (body === null) {
		return invalidRequestBodyResponse();
	}

	const parsed = attemptSchema.safeParse(body);
	if (!parsed.success) {
		return validationErrorResponse(parsed.error);
	}

	try {
		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const attempt = await mcqService.recordAttempt(id, parsed.data.choiceId);

		if (!attempt) {
			return Response.json({ error: "MCQ not found" }, { status: 404 });
		}

		return Response.json({ attempt }, { status: 201 });
	} catch {
		return internalServerErrorResponse();
	}
}
