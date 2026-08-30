"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const DISPLAY_NAME_KEY = "quizmaker.displayName";

function getStoredDisplayName(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	return sessionStorage.getItem(DISPLAY_NAME_KEY);
}

export function McqStub() {
	const router = useRouter();
	const [displayName] = useState(getStoredDisplayName);
	const [isLoggingOut, setIsLoggingOut] = useState(false);

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

	return (
		<Card className="w-full max-w-lg">
			<CardHeader>
				<CardTitle>MCQ Test Bank</CardTitle>
				<CardDescription>
					{displayName ? `Welcome, ${displayName}. ` : ""}
					Your quiz workspace is on the way.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="text-muted-foreground">Coming Soon</p>
				<Button type="button" variant="outline" onClick={handleLogout} disabled={isLoggingOut}>
					{isLoggingOut ? "Logging out…" : "Log out"}
				</Button>
			</CardContent>
		</Card>
	);
}
