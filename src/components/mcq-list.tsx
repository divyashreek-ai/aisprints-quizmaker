"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { McqSummary } from "@/lib/types/mcq";

const DISPLAY_NAME_KEY = "quizmaker.displayName";

function getStoredDisplayName(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	return sessionStorage.getItem(DISPLAY_NAME_KEY);
}

export function truncateQuestion(question: string, maxLength = 80): string {
	if (question.length <= maxLength) {
		return question;
	}

	return `${question.slice(0, maxLength)}…`;
}

export function McqList() {
	const router = useRouter();
	const [displayName] = useState(getStoredDisplayName);
	const [mcqs, setMcqs] = useState<McqSummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [mcqToDelete, setMcqToDelete] = useState<McqSummary | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	async function reloadMcqs() {
		setError(null);

		try {
			const response = await fetch("/api/mcqs");
			if (!response.ok) {
				throw new Error("Failed to load MCQs");
			}

			const body = (await response.json()) as { mcqs: McqSummary[] };
			setMcqs(body.mcqs);
		} catch {
			setError("Unable to load MCQs. Please try again.");
		}
	}

	useEffect(() => {
		let cancelled = false;

		async function loadInitialMcqs() {
			try {
				const response = await fetch("/api/mcqs");
				if (!response.ok) {
					throw new Error("Failed to load MCQs");
				}

				const body = (await response.json()) as { mcqs: McqSummary[] };
				if (!cancelled) {
					setMcqs(body.mcqs);
				}
			} catch {
				if (!cancelled) {
					setError("Unable to load MCQs. Please try again.");
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		void loadInitialMcqs();

		return () => {
			cancelled = true;
		};
	}, []);

	async function handleLogout() {
		setIsLoggingOut(true);

		try {
			await fetch("/api/auth/logout", { method: "POST" });
			sessionStorage.removeItem(DISPLAY_NAME_KEY);
			router.push("/login");
		} catch {
			setIsLoggingOut(false);
		}
	}

	async function handleDeleteConfirm() {
		if (!mcqToDelete) {
			return;
		}

		setIsDeleting(true);

		try {
			const response = await fetch(`/api/mcqs/${mcqToDelete.id}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete MCQ");
			}

			setMcqToDelete(null);
			await reloadMcqs();
		} catch {
			setError("Unable to delete MCQ. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	}

	return (
		<Card className="w-full max-w-5xl">
			<CardHeader className="flex flex-row items-start justify-between gap-4">
				<div className="flex flex-col gap-1.5">
					<CardTitle>MCQ Test Bank</CardTitle>
					<CardDescription>
						{displayName ? `Welcome, ${displayName}. ` : ""}
						Manage your multiple-choice questions.
					</CardDescription>
				</div>
				<div className="flex shrink-0 gap-2">
					<Button render={<Link href="/mcq/new" />}>Create MCQ</Button>
					<Button
						type="button"
						variant="outline"
						onClick={handleLogout}
						disabled={isLoggingOut}
					>
						{isLoggingOut ? "Logging out…" : "Log out"}
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<p className="text-muted-foreground">Loading MCQs…</p>
				) : error ? (
					<p className="text-destructive">{error}</p>
				) : mcqs.length === 0 ? (
					<div className="flex flex-col items-start gap-4">
						<p className="text-muted-foreground">No MCQs yet. Create your first question to get started.</p>
						<Button render={<Link href="/mcq/new" />}>Create MCQ</Button>
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Question</TableHead>
								<TableHead className="w-16 text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{mcqs.map((mcq) => (
								<TableRow key={mcq.id}>
									<TableCell className="font-medium">{mcq.name}</TableCell>
									<TableCell className="max-w-md whitespace-normal text-muted-foreground">
										{truncateQuestion(mcq.question)}
									</TableCell>
									<TableCell className="text-right">
										<DropdownMenu>
											<DropdownMenuTrigger
												aria-label="Open actions menu"
												render={
													<Button variant="ghost" size="icon-sm" type="button" />
												}
											>
												<MoreVertical />
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => router.push(`/mcq/${mcq.id}/edit`)}>
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem onClick={() => router.push(`/mcq/${mcq.id}/preview`)}>
													Preview
												</DropdownMenuItem>
												<DropdownMenuItem
													variant="destructive"
													onClick={() => setMcqToDelete(mcq)}
												>
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>

			<Dialog
				open={mcqToDelete !== null}
				onOpenChange={(open) => {
					if (!open) {
						setMcqToDelete(null);
					}
				}}
			>
				<DialogContent showCloseButton>
					<DialogHeader>
						<DialogTitle>Delete MCQ</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete &ldquo;{mcqToDelete?.name}&rdquo;? This cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setMcqToDelete(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={handleDeleteConfirm}
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting…" : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
