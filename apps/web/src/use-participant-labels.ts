import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { addParticipantLabels } from "./participant-labels";

const EMPTY: ReadonlyMap<string, number> = new Map();

type Registry = { roomId: string; labels: ReadonlyMap<string, number>; closed: boolean };

export function useParticipantLabels(
  roomId: string,
  selfId: string,
  presenceIds: readonly string[],
  messages: readonly { senderSessionId: string }[],
  active: boolean
) {
  const [registry, setRegistry] = useState<Registry>({ roomId, labels: EMPTY, closed: false });
  const observedIds = useMemo(
    () => [...presenceIds, ...messages.map(message => message.senderSessionId)],
    [presenceIds, messages]
  );
  // Allocate outside render and before paint so new authors and removal buttons
  // receive their distinct names together. Departures do not recycle ordinals.
  useLayoutEffect(() => {
    setRegistry(previous => {
      const current = previous.roomId === roomId ? previous : { roomId, labels: EMPTY, closed: false };
      if (current.closed) return current;
      const labels = active ? addParticipantLabels(current.labels, observedIds, selfId) : EMPTY;
      return labels === current.labels ? current : { ...current, labels };
    });
  }, [roomId, selfId, observedIds, active]);

  const clear = useCallback(() => {
    setRegistry(previous => previous.roomId === roomId && previous.closed
      ? previous : { roomId, labels: EMPTY, closed: true });
  }, [roomId]);

  return {
    labels: active && registry.roomId === roomId ? registry.labels : EMPTY,
    clear
  };
}
