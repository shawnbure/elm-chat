import { describe, expect, it } from "vitest";
import { reconnectDelayMs } from "../apps/web/src/reconnect";
import { ReplayGuard, type ReplayStorage } from "../apps/web/src/replay";

describe("client recovery state", () => {
  it("uses bounded exponential reconnect attempts", () => {
    expect([0, 1, 2, 3, 4].map(reconnectDelayMs)).toEqual([500, 1000, 2000, 4000, 8000]);
    expect(reconnectDelayMs(5)).toBeNull();
    expect(reconnectDelayMs(-1)).toBeNull();
  });

  it("restores bounded replay IDs and handles corrupt or unavailable storage", async () => {
    const values = new Map<string, string>();
    const storage: ReplayStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); }
    };
    const first = new ReplayGuard(2, storage, "room");
    expect(await first.accept("one", null, async () => {})).toBe(true);
    expect(await new ReplayGuard(2, storage, "room").accept("one", null, async () => {})).toBe(false);
    expect(await first.accept("two", null, async () => {})).toBe(true);
    await expect(first.accept("three", null, async () => {})).rejects.toThrow(/limit/);

    values.set("corrupt", "{");
    expect(await new ReplayGuard(2, storage, "corrupt").accept("fresh", null, async () => {})).toBe(true);
    const unavailable: ReplayStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); }
    };
    expect(await new ReplayGuard(2, unavailable, "room").accept("live", null, async () => {})).toBe(true);
  });
});
