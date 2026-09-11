"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getStoredUserId } from "@/lib/auth/session";
import type { McqWithChoices } from "@/lib/types/mcq";
import { createMcqSchema, updateMcqSchema } from "@/lib/validation/mcq";

type ChoiceFormState = {
	clientId: string;
	choiceText: string;
	isCorrect: boolean;
};

type McqFormProps =
	| {
			mode: "create";
	  }
	| {
			mode: "edit";
			mcqId: string;
	  };

const defaultChoices: ChoiceFormState[] = [
	{ clientId: "choice-1", choiceText: "", isCorrect: true },
	{ clientId: "choice-2", choiceText: "", isCorrect: false },
];

export function McqForm(props: McqFormProps) {
	const router = useRouter();
	const choiceIdRef = useRef(2);
	const mcqId = props.mode === "edit" ? props.mcqId : null;

	const [name, setName] = useState("");
	const [question, setQuestion] = useState("");
	const [choices, setChoices] = useState<ChoiceFormState[]>(defaultChoices);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoading, setIsLoading] = useState(props.mode === "edit");

	function addChoice() {
		if (choices.length >= 6) {
			return;
		}

		choiceIdRef.current += 1;
		setChoices((current) => [
			...current,
			{
				clientId: `choice-${choiceIdRef.current}`,
				choiceText: "",
				isCorrect: false,
			},
		]);
	}

	function removeChoice(index: number) {
		if (choices.length <= 2) {
			return;
		}

		setChoices((current) => current.filter((_, choiceIndex) => choiceIndex !== index));
	}

	function handleCorrectChange(index: number, checked: boolean) {
		if (checked) {
			setChoices((current) =>
				current.map((choice, choiceIndex) => ({
					...choice,
					isCorrect: choiceIndex === index,
				})),
			);
			return;
		}

		setChoices((current) =>
			current.map((choice, choiceIndex) =>
				choiceIndex === index ? { ...choice, isCorrect: false } : choice,
			),
		);
	}

	useEffect(() => {
		if (!mcqId) {
			return;
		}

		let cancelled = false;

		async function loadMcq() {
			try {
				const response = await fetch(`/api/mcqs/${mcqId}`);
				if (!response.ok) {
					throw new Error("Failed to load MCQ");
				}

				const body = (await response.json()) as { mcq: McqWithChoices };
				if (cancelled) {
					return;
				}

				setName(body.mcq.name);
				setQuestion(body.mcq.question);
				setChoices(
					body.mcq.choices.map((choice) => ({
						clientId: choice.id,
						choiceText: choice.choiceText,
						isCorrect: choice.isCorrect,
					})),
				);
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

		const choicePayload = choices.map((choice) => ({
			choiceText: choice.choiceText,
			isCorrect: choice.isCorrect,
		}));

		if (props.mode === "create") {
			const createdByUserId = getStoredUserId();
			if (!createdByUserId) {
				setError("Please log in to create MCQs.");
				return;
			}

			const parsed = createMcqSchema.safeParse({
				name,
				question,
				createdByUserId,
				choices: choicePayload,
			});

			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Validation failed");
				return;
			}

			setIsSubmitting(true);

			try {
				const response = await fetch("/api/mcqs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(parsed.data),
				});

				if (!response.ok) {
					const data = (await response.json()) as { error?: string };
					setError(data.error ?? "Failed to create MCQ");
					return;
				}

				router.push("/mcq");
			} catch {
				setError("Something went wrong. Please try again.");
			} finally {
				setIsSubmitting(false);
			}

			return;
		}

		const parsed = updateMcqSchema.safeParse({
			name,
			question,
			choices: choicePayload,
		});

		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Validation failed");
			return;
		}

		if (!mcqId) {
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch(`/api/mcqs/${mcqId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(parsed.data),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				setError(data.error ?? "Failed to update MCQ");
				return;
			}

			router.push("/mcq");
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
					<p className="text-muted-foreground">Loading MCQ…</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-2xl">
			<CardHeader>
				<CardTitle>{props.mode === "create" ? "Create MCQ" : "Edit MCQ"}</CardTitle>
				<CardDescription>
					{props.mode === "create"
						? "Add a new multiple-choice question to your test bank."
						: "Update this multiple-choice question."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="mcq-name">Name</FieldLabel>
							<Input
								id="mcq-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="Chapter 1 Review"
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="mcq-question">Question</FieldLabel>
							<Textarea
								id="mcq-question"
								value={question}
								onChange={(event) => setQuestion(event.target.value)}
								placeholder="What is the capital of Texas?"
								required
							/>
						</Field>
						<Field>
							<FieldLabel>Choices</FieldLabel>
							<FieldDescription>
								Provide 2 to 6 choices and mark exactly one as correct.
							</FieldDescription>
							<div className="flex flex-col gap-3">
								{choices.map((choice, index) => (
									<div key={choice.clientId} className="flex items-start gap-3">
										<Input
											aria-label={`Choice ${index + 1}`}
											value={choice.choiceText}
											onChange={(event) =>
												setChoices((current) =>
													current.map((item, choiceIndex) =>
														choiceIndex === index
															? { ...item, choiceText: event.target.value }
															: item,
													),
												)
											}
											placeholder={`Choice ${index + 1}`}
											required
										/>
										<div className="flex items-center gap-2 pt-2">
											<Checkbox
												aria-label={`Mark choice ${index + 1} correct`}
												checked={choice.isCorrect}
												onCheckedChange={(checked) =>
													handleCorrectChange(index, checked === true)
												}
											/>
											<span className="text-sm text-muted-foreground">Correct</span>
										</div>
										{choices.length > 2 ? (
											<Button
												type="button"
												variant="outline"
												onClick={() => removeChoice(index)}
												aria-label={`Remove choice ${index + 1}`}
											>
												Remove
											</Button>
										) : null}
									</div>
								))}
							</div>
							{choices.length < 6 ? (
								<Button type="button" variant="outline" onClick={addChoice}>
									Add choice
								</Button>
							) : null}
						</Field>
						{error ? <FieldError>{error}</FieldError> : null}
						<div className="flex gap-2">
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Saving…" : "Save"}
							</Button>
							<Button type="button" variant="outline" onClick={() => router.push("/mcq")}>
								Cancel
							</Button>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
