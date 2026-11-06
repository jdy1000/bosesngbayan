/**
 * Minimal structured server logger. Logs error name/message/code only — never request bodies,
 * tokens, emails, or IP addresses.
 */
export function logServerError(event: string, error: unknown): void {
  const e = error as { name?: string; message?: string; code?: string } | null;
  const entry = {
    level: "error",
    event,
    name: e?.name,
    code: e?.code,
    message: typeof e?.message === "string" ? e.message.slice(0, 300) : String(error).slice(0, 300),
    at: new Date().toISOString(),
  };
  console.error(JSON.stringify(entry));
}
