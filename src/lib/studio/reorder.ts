/** Move `id` one step up or down in an ordered id list. Returns a new array (unchanged if at an edge). */
export function moveId(ids: readonly string[], id: string, direction: "up" | "down"): string[] {
  const next = [...ids];
  const i = next.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= next.length) return next;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Position updates needed to store `ordered` as positions 0, 10, 20… (only rows that change). */
export function positionUpdates(ordered: readonly { id: string; position: number }[], newOrder: readonly string[]): { id: string; position: number }[] {
  const current = new Map(ordered.map((r) => [r.id, r.position]));
  return newOrder.map((id, index) => ({ id, position: index * 10 })).filter((u) => current.get(u.id) !== u.position);
}
