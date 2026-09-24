export const MAX_RECONNECT_ATTEMPTS = 5;

export function reconnectDelayMs(attempt: number): number | null {
  if (!Number.isSafeInteger(attempt) || attempt < 0 || attempt >= MAX_RECONNECT_ATTEMPTS) {
    return null;
  }
  return Math.min(500 * 2 ** attempt, 8000);
}
