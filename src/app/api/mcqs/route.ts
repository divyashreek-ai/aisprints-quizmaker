import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	internalServerErrorResponse,
	invalidRequestBodyResponse,
	parseJsonBody,
	validationErrorResponse,
} from "@/lib/api/http";
import {
	createMcqService,
	InvalidMcqChoicesError,
	UserNotFoundError,
} from "@/lib/services/mcq-service";
import { createMcqSchema } from "@/lib/validation/mcq";

export async function GET() {
	try {
		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const mcqs = await mcqService.listMcqs();
		return Response.json({ mcqs });
	} catch {
		return internalServerErrorResponse();
	}
}

export async function POST(request: Request) {
	const body = await parseJsonBody(request);
	if (body === null) {
		return invalidRequestBodyResponse();
	}

	const parsed = createMcqSchema.safeParse(body);
	if (!parsed.success) {
		return validationErrorResponse(parsed.error);
	}

	try {
		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const mcq = await mcqService.createMcq(parsed.data);
		return Response.json({ mcq }, { status: 201 });
	} catch (error) {
		if (error instanceof UserNotFoundError) {
			return Response.json({ error: "User not found" }, { status: 404 });
		}

		if (error instanceof InvalidMcqChoicesError) {
			return Response.json({ error: error.message }, { status: 400 });
		}

		return internalServerErrorResponse();
	}
}
