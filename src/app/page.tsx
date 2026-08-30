import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
	return (
		<div className="flex min-h-svh w-full flex-col items-center justify-center gap-8 p-6 md:p-10">
			<div className="flex max-w-md flex-col items-center gap-3 text-center">
				<h1 className="text-3xl font-semibold tracking-tight">QuizMaker</h1>
				<p className="text-muted-foreground">
					Create an account or sign in to reach the MCQ test bank stub.
				</p>
			</div>
			<div className="flex flex-col gap-3 sm:flex-row">
				<Button render={<Link href="/register" />} nativeButton={false}>
					Register
				</Button>
				<Button render={<Link href="/login" />} nativeButton={false} variant="outline">
					Login
				</Button>
			</div>
		</div>
	);
}
