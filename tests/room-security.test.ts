import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../workers/api/src/index";
import type { CreateRoomResponse, RoomMetadata } from "@elm-chat/shared";

async function createRoom(): Promise<CreateRoomResponse> {
  const response = await worker.fetch(
    new Request("https://elm.chat/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inactivityTimeoutMs: 60_000, maxAgeMs: 120_000 })
    }),
    env
  );
  expect(response.status).toBe(201);
  return response.json();
}

async function metadata(roomId: string): Promise<RoomMetadata> {
  const response = await env.ROOM_OBJECT.getByName(roomId).fetch("https://room/internal/metadata");
  expect(response.status).toBe(200);
  return response.json();
}

async function openUnjoined(roomId: string): Promise<WebSocket | Response> {
  const response = await env.ROOM_OBJECT.getByName(roomId).fetch(
    new Request("https://room/ws", { headers: { Upgrade: "websocket" } })
  );
  if (response.status !== 101) return response;
  const socket = response.webSocket!;
  socket.accept();
  return socket;
}

describe("room admission and creator capability", () => {
  it("does not let an unjoined socket or ping refresh room activity", async () => {
    const room = await createRoom();
    const before = await metadata(room.roomId);
    const socket = await openUnjoined(room.roomId);
    expect(socket).toBeInstanceOf(WebSocket);
    if (!(socket instanceof WebSocket)) return;
    try {
      expect((await metadata(room.roomId)).lastActivityAt).toBe(before.lastActivityAt);
      const error = new Promise<{ type: string; code: string }>((resolve) => {
        socket.addEventListener("message", (event) => resolve(JSON.parse(String(event.data))), { once: true });
      });
      socket.send(JSON.stringify({ type: "ping" }));
      expect(await error).toMatchObject({ type: "error", code: "join_required" });
      expect((await metadata(room.roomId)).lastActivityAt).toBe(before.lastActivityAt);
    } finally {
      socket.close();
    }
  });

  it("counts sockets awaiting join toward the room capacity", async () => {
    const room = await createRoom();
    const sockets: WebSocket[] = [];
    try {
      for (let index = 0; index < 16; index += 1) {
        const socket = await openUnjoined(room.roomId);
        expect(socket).toBeInstanceOf(WebSocket);
        if (socket instanceof WebSocket) sockets.push(socket);
      }
      expect((await metadata(room.roomId)).participantCount).toBe(0);
      const excess = await openUnjoined(room.roomId);
      expect(excess).toBeInstanceOf(Response);
      if (excess instanceof Response) expect(excess.status).toBe(409);
    } finally {
      for (const socket of sockets) socket.close();
    }
  });

  it("closes a socket that does not join before its deadline", async () => {
    const room = await createRoom();
    const stub = env.ROOM_OBJECT.getByName(room.roomId);
    const socket = await openUnjoined(room.roomId);
    expect(socket).toBeInstanceOf(WebSocket);
    if (!(socket instanceof WebSocket)) return;
    try {
      const closed = new Promise<number>((resolve) => {
        socket.addEventListener("close", (event) => resolve(event.code), { once: true });
      });
      await runInDurableObject(stub, async (_instance, state) => {
        const [server] = state.getWebSockets();
        const attachment = server.deserializeAttachment() as { connectedAt: number };
        server.serializeAttachment({ ...attachment, connectedAt: Date.now() - 20_000 });
        await state.storage.setAlarm(Date.now() + 1_000);
      });
      expect(await runDurableObjectAlarm(stub)).toBe(true);
      expect(await closed).toBe(4408);
      const next = await openUnjoined(room.roomId);
      expect(next).toBeInstanceOf(WebSocket);
      if (next instanceof WebSocket) next.close();
    } finally {
      socket.close();
    }
  });

  it("still admits a valid creator join", async () => {
    const room = await createRoom();
    const socket = await openUnjoined(room.roomId);
    expect(socket).toBeInstanceOf(WebSocket);
    if (!(socket instanceof WebSocket)) return;
    try {
      const joined = new Promise<{ type: string; creator: boolean }>((resolve) => {
        socket.addEventListener("message", (event) => resolve(JSON.parse(String(event.data))), { once: true });
      });
      socket.send(JSON.stringify({
        type: "join",
        sessionId: crypto.randomUUID(),
        identityKey: "test-public-key",
        creatorToken: room.creatorToken
      }));
      expect(await joined).toMatchObject({ type: "joined", creator: true });
      expect((await metadata(room.roomId)).creatorJoined).toBe(true);
    } finally {
      socket.close();
    }
  });

  it("rejects a join without a usable session ID", async () => {
    const room = await createRoom();
    const socket = await openUnjoined(room.roomId);
    expect(socket).toBeInstanceOf(WebSocket);
    if (!(socket instanceof WebSocket)) return;
    try {
      const error = new Promise<{ type: string; code: string }>((resolve) => {
        socket.addEventListener("message", (event) => resolve(JSON.parse(String(event.data))), { once: true });
      });
      socket.send(JSON.stringify({
        type: "join",
        sessionId: "",
        identityKey: "test-public-key",
        creatorToken: room.creatorToken
      }));
      expect(await error).toMatchObject({ type: "error", code: "invalid_join" });
      expect((await metadata(room.roomId)).participantCount).toBe(0);
    } finally {
      socket.close();
    }
  });

  it("lists invites with a bearer token, not a query-string capability", async () => {
    const room = await createRoom();
    const path = `https://elm.chat/api/rooms/${room.roomId}/invites`;
    const legacy = await worker.fetch(new Request(`${path}?creatorToken=${room.creatorToken}`), env);
    expect(legacy.status).toBe(403);
    const authorized = await worker.fetch(
      new Request(path, { headers: { authorization: `Bearer ${room.creatorToken}` } }),
      env
    );
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("cache-control")).toBe("no-store");
    expect(await authorized.json()).toEqual([]);
  });
});
