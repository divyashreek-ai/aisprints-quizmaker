"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { McqWithChoices } from "@/lib/types/mcq";

type McqPreviewProps = {
	mcqId: string;
};

export function McqPreview({ mcqId }: McqPreviewProps) {
	const [mcq, setMcq] = useState<McqWithChoices | null>(null);
	const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
	const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function loadMcq() {
			try {
				const response = await fetch(`/api/mcqs/${mcqId}`);
				if (!response.ok) {
					throw new Error("Failed to load MCQ");
				}

				const body = (await response.json()) as { mcq: McqWithChoices };
				if (!cancelled) {
					setMcq(body.mcq);
				}
			} catch {
				if (!cancelled) {
					setError("Unable to load this MCQ. Please try again.");
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		void loadMcq();

		return () => {
			cancelled = true;
		};
	}, [mcqId]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		if (!selectedChoiceId) {
			setError("Select an answer before submitting.");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch(`/api/mcqs/${mcqId}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ choiceId: selectedChoiceId }),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				setError(data.error ?? "Failed to submit answer");
				return;
			}

			const data = (await response.json()) as { attempt: { isCorrect: boolean } };
			setResult(data.attempt.isCorrect ? "correct" : "incorrect");
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isLoading) {
		return (
			<Card className="w-full max-w-2xl">
				<CardContent className="pt-6">
					<p className="text-muted-foreground">Loading preview…</p>
				</CardContent>
			</Card>
		);
	}

	if (!mcq) {
		return (
			<Card className="w-full max-w-2xl">
				<CardContent className="flex flex-col gap-4 pt-6">
					<p className="text-destructive">{error ?? "MCQ not found."}</p>
					<Button render={<Link href="/mcq" />} nativeButton={false}>
						Back to list
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-2xl">
			<CardHeader>
				<CardTitle>{mcq.name}</CardTitle>
				<CardDescription>Preview this question and submit an answer.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<p className="text-base font-medium">{mcq.question}</p>
						<div className="flex flex-col gap-3">
							{mcq.choices.map((choice) => (
								<label
									key={choice.id}
									className="flex items-center gap-3 rounded-lg border border-border p-3"
								>
									<input
										type="radio"
										name="preview-choice"
										value={choice.id}
										checked={selectedChoiceId === choice.id}
										onChange={() => setSelectedChoiceId(choice.id)}
										disabled={result !== null}
									/>
									<span>{choice.choiceText}</span>
								</label>
							))}
						</div>
						{error ? <FieldError>{error}</FieldError> : null}
						{result ? (
							<div>
								<FieldLabel>Result</FieldLabel>
								<Badge variant={result === "correct" ? "default" : "destructive"}>
									{result === "correct" ? "Correct" : "Incorrect"}
								</Badge>
							</div>
						) : null}
						<div className="flex gap-2">
							<Button type="submit" disabled={isSubmitting || result !== null}>
								{isSubmitting ? "Submitting…" : "Submit answer"}
							</Button>
							<Button
								type="button"
								variant="outline"
								render={<Link href="/mcq" />}
								nativeButton={false}
							>
								Back to list
							</Button>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
