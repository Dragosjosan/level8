export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return fallback
  }

  return error instanceof Error && error.message.trim() ? error.message : fallback
}
