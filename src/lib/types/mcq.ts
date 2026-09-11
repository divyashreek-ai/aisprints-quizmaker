export type McqSummary = {
	id: string;
	name: string;
	question: string;
	createdByUserId: string;
	createdAt: string;
	updatedAt: string;
};

export type McqChoice = {
	id: string;
	choiceText: string;
	isCorrect: boolean;
	position: number;
};

export type McqWithChoices = McqSummary & {
	choices: McqChoice[];
};

export type AttemptResult = {
	id: string;
	mcqId: string;
	choiceId: string;
	isCorrect: boolean;
	createdAt: string;
};

export type McqChoiceInput = {
	choiceText: string;
	isCorrect: boolean;
};

export type CreateMcqInput = {
	name: string;
	question: string;
	createdByUserId: string;
	choices: McqChoiceInput[];
};

export type UpdateMcqInput = {
	name: string;
	question: string;
	choices: McqChoiceInput[];
};
