import "server-only";

/** Like unwrap() but for queries whose data must be present (.single(), selects, RPC results). */
export function need<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error("not_found");
  return result.data as NonNullable<T>;
}
