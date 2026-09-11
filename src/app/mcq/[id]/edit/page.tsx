import { McqForm } from "@/components/mcq-form";

type EditMcqPageProps = {
	params: Promise<{ id: string }>;
};

export default async function EditMcqPage({ params }: EditMcqPageProps) {
	const { id } = await params;

	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<McqForm mode="edit" mcqId={id} />
		</div>
	);
}
