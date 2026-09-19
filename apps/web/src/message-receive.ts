import { decryptMessage } from "@elm-chat/crypto";
import { MESSAGE_PROTOCOL_VERSION, type EncryptedMessageEnvelope } from "@elm-chat/shared";
import { ReplayGuard } from "./replay";

export class InvalidMessageEnvelopeError extends Error {}

export async function receiveTextMessage(
  key: CryptoKey,
  roomId: string,
  envelope: EncryptedMessageEnvelope,
  guard: ReplayGuard,
  relaySenderId?: string,
  now = Date.now()
): Promise<{ plaintext: string; expiresAt?: number } | null> {
  if (
    !envelope ||
    envelope.protocolVersion !== MESSAGE_PROTOCOL_VERSION ||
    (relaySenderId && relaySenderId !== envelope.senderSessionId)
  ) {
    throw new InvalidMessageEnvelopeError("Unsupported version or relay sender mismatch.");
  }

  let plaintext = "";
  const accepted = await guard.accept(envelope.messageId, async () => {
    plaintext = await decryptMessage(key, roomId, envelope);
  });
  if (!accepted) return null;

  const expiresAt =
    typeof envelope.expiresAfterReadSeconds === "number"
      ? envelope.sentAt + envelope.expiresAfterReadSeconds * 1000
      : undefined;
  if (typeof expiresAt === "number" && expiresAt <= now) return null;

  return { plaintext, expiresAt };
}
