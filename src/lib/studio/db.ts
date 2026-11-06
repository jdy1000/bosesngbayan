/** Like unwrap(), for selects: throws the PostgREST error, and treats a missing payload as an error too. */
export function must<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error("empty_result");
  return result.data as NonNullable<T>;
}
