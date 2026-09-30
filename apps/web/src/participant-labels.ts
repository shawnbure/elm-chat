// Presentation-only ordinals: never persisted, transmitted, or reused in a room view.
export function addParticipantLabels(
  current: ReadonlyMap<string, number>,
  sessionIds: readonly string[],
  selfId: string
): ReadonlyMap<string, number> {
  const additions = [...new Set(sessionIds)]
    .filter(id => id !== selfId && !current.has(id))
    .sort();
  if (additions.length === 0) return current;
  const next = new Map(current);
  for (const id of additions) next.set(id, next.size + 1);
  return next;
}
