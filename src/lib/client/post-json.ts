/** Browser helper for the public JSON endpoints. Always resolves; never throws. */
export async function postJson<T extends Record<string, unknown>>(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; data: T & { message?: string; error?: string } }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = ((await res.json().catch(() => ({}))) ?? {}) as T & { message?: string; error?: string };
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Walang koneksyon. Subukang muli." } as T & { error: string } };
  }
}
