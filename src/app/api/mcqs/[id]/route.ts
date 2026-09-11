import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	internalServerErrorResponse,
	invalidRequestBodyResponse,
	parseJsonBody,
	validationErrorResponse,
} from "@/lib/api/http";
import { createMcqService, InvalidMcqChoicesError } from "@/lib/services/mcq-service";
import { updateMcqSchema } from "@/lib/validation/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
	const { id } = await context.params;

	try {
		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const mcq = await mcqService.getMcqById(id);

		if (!mcq) {
			return Response.json({ error: "MCQ not found" }, { status: 404 });
		}

		return Response.json({ mcq });
	} catch {
		return internalServerErrorResponse();
	}
}

export async function PUT(request: Request, context: RouteContext) {
	const { id } = await context.params;
	const body = await parseJsonBody(request);

	if (body === null) {
		return invalidRequestBodyResponse();
	}

	const parsed = updateMcqSchema.safeParse(body);
	if (!parsed.success) {
		return validationErrorResponse(parsed.error);
	}

	try {
		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const mcq = await mcqService.updateMcq(id, parsed.data);

		if (!mcq) {
			return Response.json({ error: "MCQ not found" }, { status: 404 });
		}

		return Response.json({ mcq });
	} catch (error) {
		if (error instanceof InvalidMcqChoicesError) {
			return Response.json({ error: error.message }, { status: 400 });
		}

		return internalServerErrorResponse();
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	const { id } = await context.params;

	try {
		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const deleted = await mcqService.deleteMcq(id);

		if (!deleted) {
			return Response.json({ error: "MCQ not found" }, { status: 404 });
		}

		return Response.json({ success: true });
	} catch {
		return internalServerErrorResponse();
	}
}
