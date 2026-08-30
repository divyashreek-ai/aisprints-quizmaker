const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const ALGORITHM = "PBKDF2";
const HASH = "SHA-256";
const HASH_PREFIX = "pbkdf2-sha256";

function bytesToBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a[i] ^ b[i];
	}

	return result === 0;
}

async function deriveKey(plain: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(plain),
		ALGORITHM,
		false,
		["deriveBits"],
	);

	const saltBytes = Uint8Array.from(salt);
	const derived = await crypto.subtle.deriveBits(
		{
			name: ALGORITHM,
			salt: saltBytes,
			iterations,
			hash: HASH,
		},
		keyMaterial,
		KEY_BYTES * 8,
	);

	return new Uint8Array(derived);
}

export async function hashPassword(plain: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hashBytes = await deriveKey(plain, salt, ITERATIONS);

	return `${HASH_PREFIX}$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hashBytes)}`;
}

export async function verifyPassword(plain: string, encoded: string): Promise<boolean> {
	const parts = encoded.split("$");
	if (parts.length !== 4 || parts[0] !== HASH_PREFIX) {
		return false;
	}

	const iterations = Number(parts[1]);
	if (!Number.isFinite(iterations) || iterations <= 0) {
		return false;
	}

	const salt = base64ToBytes(parts[2]);
	const expectedHash = base64ToBytes(parts[3]);
	const actualHash = await deriveKey(plain, salt, iterations);

	return timingSafeEqual(actualHash, expectedHash);
}
