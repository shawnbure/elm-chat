import type { RoomMetadata } from "@elm-chat/shared";

export function roomExpiryReason(
  room: Pick<RoomMetadata, "expiresAt" | "inactivityTimeoutMs" | "lastActivityAt">,
  now: number,
  connectedCount: number
): "max-age" | "join-timeout" | "inactive" | null {
  if (room.expiresAt !== null && now >= room.expiresAt) return "max-age";
  if (
    room.inactivityTimeoutMs !== null &&
    now - room.lastActivityAt >= room.inactivityTimeoutMs
  ) {
    return connectedCount === 0 ? "join-timeout" : "inactive";
  }
  return null;
}
