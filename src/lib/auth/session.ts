export const DISPLAY_NAME_KEY = "quizmaker.displayName";
export const USER_ID_KEY = "quizmaker.userId";

export function getStoredUserId(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	return sessionStorage.getItem(USER_ID_KEY);
}
