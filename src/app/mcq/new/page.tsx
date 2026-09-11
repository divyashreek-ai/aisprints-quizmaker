import { McqForm } from "@/components/mcq-form";

export default function NewMcqPage() {
	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<McqForm mode="create" />
		</div>
	);
}
